require("dotenv").config({path: process.argv[2] || undefined})

import {combineLatest, of} from "rxjs"
import {
    debounceTime,
    distinct,
    filter,
    groupBy,
    map,
    mergeMap,
    toArray,
    withLatestFrom,
} from "rxjs/operators"
import uuid from "uuid/v4"
import {KeyPair, loadKeyPair} from "./crypto"
import {broadcastSignedMessage, mqttMain, packetsSubject} from "./mqtt"
import {
    calculateConfidenceScore,
    getPacketInformation,
    isMineAtAnyPoint,
    packetIdCalculator,
    verifyPacket,
} from "./packet-utils"
import {getQrCodeLocation, qrCodes, sensedQrCode} from "./qr"
import {commandsMain, executeCommand} from "./robot"
import {
    confidenceThreshold,
    packetExpirationDuration,
    sensingThreshold,
} from "./settings"
import {socketMain} from "./socketio"
import {BroadcastPacket, Packet, Signed, SignedPacket} from "./types"
import {runAsync, unreachable} from "./util"

const processedPacketIds = new Set<string>()

const streamSetup = ({publicKey}: KeyPair) => {
    // ignore expired packets
    const nonExpiredPackets = packetsSubject.pipe(
        filter(({source: {id, timestamp}}) => {
            if (Date.now() - timestamp > packetExpirationDuration) {
                console.log(`Packet ${id} has already expired. Ignoring...`)
                return false
            }
            return true
        }),
    )

    // pipe out packets that are not mine
    const nonMinePackets = nonExpiredPackets.pipe(
        filter(packet => !isMineAtAnyPoint(packet, publicKey)),
    )
    // these are packets that are verified by the QR code that they pretend to be from
    const verifiedPackets = nonMinePackets.pipe(
        // tap(packet => console.log({packet})),
        filter(packet => verifyPacket(packet)),
    )
    // get the packet original information so we don't have to recalculate in the future
    const packetInformation = verifiedPackets.pipe(map(getPacketInformation))
    // filter out packets that we have processed already
    const nonProcessedpacketInformation = packetInformation.pipe(
        filter(({original}) => !processedPacketIds.has(original.source.id)),
    )
    const groupedPackets = nonProcessedpacketInformation.pipe(
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
                toArray(),
                // subscribe to live updating qr code registry
                withLatestFrom(qrCodes),
            ),
        ),
    )
    // legitimate packets that have passed confidence threshold
    const legitimatePackets = groupedPackets.pipe(
        // calculate confidence scores
        map(([informations, registry]) => ({
            confidence: calculateConfidenceScore(informations, registry),
            original: informations[0].original,
        })),
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

const dumpSignature = <T extends Packet>({
    signature,
    ...packet
}: Signed<T>): T => (packet as unknown) as T

const stringify = (packet: Packet | SignedPacket): string => {
    if ("signature" in packet) {
        return stringify(dumpSignature(packet))
    }
    return JSON.stringify(packet, undefined, 4)
}

const onNewPacket = async (packet: Signed<BroadcastPacket>) => {
    const duration = Date.now() - packet.source.timestamp
    console.log(
        `Received packet ${packet.source.id} ${duration /
            1000} seconds after it was posted.`,
    )
    console.log(`Received verified packet: ${stringify(packet)}`)

    const {event} = packet
    switch (event.type) {
        case "movement":
            await executeCommand(event.command)
            break
        default:
            unreachable()
    }
}

const main = async () => {
    console.log(`Started`)

    const {privateKey, publicKey} = await loadKeyPair()
    await Promise.all([
        mqttMain(),
        socketMain(),
        commandsMain({privateKey, publicKey}),
    ])

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

            await broadcastSignedMessage(
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
        async ({original}) => {
            console.log(original)
            const packetId = packetIdCalculator(original)
            if (processedPacketIds.has(packetId)) {
                console.log(
                    `Received a packet with id ${packetId} that has already been processed. Ignoring...`,
                )
                return
            }
            processedPacketIds.add(packetId)

            await onNewPacket(original)
        },
        error => console.log({error}),
    )
}

main().catch(console.error)
