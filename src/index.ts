require("dotenv").config({path: process.argv[2] || undefined})

import chalk from "chalk"
import {combineLatest, of} from "rxjs"
import {
    debounceTime,
    distinct,
    filter,
    groupBy,
    map,
    mergeMap,
    scan,
    tap,
} from "rxjs/operators"
import {inspect} from "util"
import uuid from "uuid/v4"
import {KeyPair, loadKeyPair} from "./crypto"
import {broadcastSignedMessage, mqttMain, packetsObservable} from "./mqtt"
import {
    calculateConfidenceScore,
    getPacketInformation,
    isMineAtAnyPoint,
    packetIdCalculator,
    verifyPacket,
} from "./packet-utils"
import {getQrCodeLocation, qrCodes, sensedQrCode} from "./qr"
import {randomPacketsMain} from "./randomPackets"
import {
    confidenceThreshold,
    packetExpirationDuration,
    sensingThreshold,
} from "./settings"
import {timelineMain} from "./timeline"
import {
    BroadcastPacket,
    Packet,
    PacketInformation,
    Signed,
    SignedPacket,
} from "./types"
import {runAsync, sleep} from "./util"

const processedPacketIds = new Set<string>()

const streamSetup = ({publicKey}: KeyPair) => {
    // ignore expired packets
    const nonExpiredPackets = packetsObservable.pipe(
        filter(({source: {id, timestamp}}) => {
            if (Date.now() - timestamp > packetExpirationDuration) {
                console.log(
                    chalk`{red Packet ${id} has already expired. Ignoring...}`,
                )
                return false
            }
            return true
        }),
    )
    // filter out packets that are not mine
    const nonMinePackets = nonExpiredPackets.pipe(
        filter<SignedPacket>(packet => !isMineAtAnyPoint(packet, publicKey)),
    )
    // these are packets that are verified by the QR code that they pretend to be from
    // NOTE: They do not need to be sensed at this point
    const verifiedPackets = nonMinePackets.pipe(
        filter(packet => verifyPacket(packet)),
    )
    // filter out packets that we have processed already
    const nonProcessedVerifiedPackets = verifiedPackets.pipe(
        filter(packet => {
            const id = packetIdCalculator(packet)
            if (processedPacketIds.has(id)) {
                console.log(`We have already processed packet ${id}. Ignoring!`)
                return false
            }
            return true
        }),
    )
    // get the packet original information so we don't have to recalculate in the future
    const packetInformation = nonProcessedVerifiedPackets.pipe(
        map(getPacketInformation),
    )
    // filter out packets that we have processed already
    const groupedPackets = packetInformation.pipe(
        // get all packets that have the same original packet (i.e., all original packets and their rebroadcasts)
        groupBy(
            ({original: {source}}) => JSON.stringify(source),
            undefined,
            grouped => grouped.pipe(debounceTime(sensingThreshold)),
        ),
        // array of groups
        mergeMap(group =>
            group.pipe(
                // remove duplicates
                distinct(({packet: {source}}) => JSON.stringify(source)),
                // remove multiple rebroadcasts by the same original source
                distinct(({packet: {source: {publicKey}}}) =>
                    JSON.stringify(publicKey),
                ),
                // convert group to array
                scan((acc, curr) => [...acc, curr], [] as PacketInformation[]),
            ),
        ),
    )
    // subscribe to live updating qr code registry
    // legitimate packets that have passed confidence threshold
    const legitimatePackets = combineLatest(groupedPackets, qrCodes).pipe(
        // ignore expired
        filter(([informations]) => {
            const {id, timestamp} = informations[0].original.source
            if (Date.now() - timestamp > packetExpirationDuration) {
                console.log(chalk`{red Packet ${id} has expired. Ignoring}`)
                return false
            }
            return true
        }),
        // ignore already processed
        filter(([[{original}]]) => {
            if (processedPacketIds.has(packetIdCalculator(original))) {
                console.log(
                    chalk`{red Packet ${original.source.id} has already been processed. Ignoring}`,
                )
                return false
            }
            return true
        }),
        // calculate confidence scores
        map(([informations, registry]) => ({
            confidence: calculateConfidenceScore(informations, registry),
            original: informations[0].original,
        })),
        tap(({confidence, original}) =>
            console.log(
                `Packet with id ${original.source.id} has confidence ${inspect(
                    confidence,
                )}`,
            ),
        ),
        // filter out packets that haven't met threshold
        filter(({confidence}) => confidence.score >= confidenceThreshold),
    )
    // packets that we have verified with our sensor information
    const rebroadcastablePackets = verifiedPackets.pipe(
        mergeMap(packet => combineLatest(of(packet), qrCodes)),
        filter(([packet, registry]) =>
            sensedQrCode(
                registry,
                packet.source.publicKey,
                packet.source.timestamp,
            ),
        ),
        distinct(([{source}]) => JSON.stringify(source)),
    )

    return {legitimatePackets, rebroadcastablePackets}
}

const stringify = (packet: Packet | SignedPacket): string => {
    if ("signature" in packet) {
        const {signature, ...rest} = packet
        return stringify(rest)
    }
    return JSON.stringify(packet, undefined, 4)
}

const onNewPacket = async (
    packet: Signed<BroadcastPacket>,
    confidence: number,
    confirmations: number,
) => {
    const duration = Date.now() - packet.source.timestamp
    console.log(
        chalk`{green Received packet ${
            packet.source.id
        } with {blue ${confidence} confidence} and {blue ${confirmations} confirmations}, {red ${duration /
            1000}} seconds after it was posted.}`,
    )
    // console.log(`Received verified packet: ${stringify(packet)}`)

    // const {event} = packet
    // switch (event.type) {
    //     default:
    //         unreachable()
    // }
}

const main = async () => {
    console.log(`Started`)

    const {privateKey, publicKey} = await loadKeyPair()
    const mqttClient = await mqttMain()

    const {legitimatePackets, rebroadcastablePackets} = streamSetup({
        privateKey,
        publicKey,
    })

    rebroadcastablePackets.subscribe(([original, registry]) =>
        runAsync(async () => {
            const location = getQrCodeLocation(
                registry,
                original.source.publicKey,
            )
            if (!location) {
                console.log(
                    `Could not get location for QR code ${original.source.publicKey}`,
                )
                return
            }
            console.log(
                chalk`{green Rebroadcasting packet ${original.source.id}}`,
            )

            await broadcastSignedMessage(
                mqttClient,
                {
                    source: {
                        id: uuid(),
                        publicKey,
                        timestamp: Date.now(),
                    },
                    type: "rebroadcast",
                    location,
                    original,
                },
                publicKey,
                privateKey,
            )
        }),
    )

    legitimatePackets.subscribe(
        async ({original, confidence}) => {
            const packetId = packetIdCalculator(original)
            if (processedPacketIds.has(packetId)) {
                console.log(
                    chalk`{red Packet ${original.source.id} has already been processed. Ignoring...}`,
                )
                return
            }
            processedPacketIds.add(packetId)

            await onNewPacket(
                original,
                confidence.score,
                confidence.confirmations,
            )
        },
        error => console.log({error}),
    )

    await sleep(500)
    await Promise.all([timelineMain(), randomPacketsMain(mqttClient)])
}

main().catch(console.error)
