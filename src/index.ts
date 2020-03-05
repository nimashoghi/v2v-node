require("dotenv").config({path: process.argv[2] || undefined})

import chalk from "chalk"
import {combineLatest, empty, of} from "rxjs"
import {
    debounceTime,
    distinct,
    filter,
    flatMap,
    groupBy,
    map,
    mergeMap,
    scan,
    tap,
    withLatestFrom,
} from "rxjs/operators"
import {inspect} from "util"
import uuid from "uuid/v4"
import {KeyPair, loadKeyPair} from "./crypto"
import {handleDemoPacket} from "./demos"
import {ipcMain} from "./ipc"
import {broadcastSignedMessage, mqttMain, packetsObservable} from "./mqtt"
import {
    calculateConfidenceScoreMany,
    getPacketInformation,
    isMineAtAnyPoint,
    packetIdCalculator,
    verifyPacket,
} from "./packet-utils"
import {qrCodes, sensedQrCode} from "./qr"
import {commandsMain} from "./robot"
import {
    confidenceThreshold,
    packetExpirationDuration,
    sensingThreshold,
} from "./settings"
import {
    BroadcastPacket,
    Packet,
    PacketInformation,
    Signed,
    SignedPacket,
    Vector2,
} from "./types"
import {runAsync, unreachable} from "./util"

const processedPacketIds = new Set<string>()

const streamSetup = ({publicKey}: KeyPair) => {
    // filter out packets that we have processed already
    const nonProcessedFirstCheck = packetsObservable.pipe(
        // tap(packet =>
        //     console.log(
        //         chalk`{green Received original packet: ${JSON.stringify(
        //             packet,
        //             undefined,
        //             4,
        //         )}}`,
        //     ),
        // ),
        // tap(packet => {
        //     if (networkDelay.has(packet.source.id)) {
        //         return
        //     }
        //     networkDelay.set(
        //         packet.source.id,
        //         Date.now() - packet.source.timestamp,
        //     )
        // }),
        filter(
            packet =>
                !processedPacketIds.has(packetIdCalculator(packet, false)),
        ),
    )
    // ignore expired packets
    const nonExpiredPackets = nonProcessedFirstCheck.pipe(
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
        // tap(packet =>
        //     console.log(
        //         chalk`{blue Received nonProcessedVerified packet: ${JSON.stringify(
        //             packet,
        //             undefined,
        //             4,
        //         )}}`,
        //     ),
        // ),
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
                distinct(
                    ({
                        packet: {
                            source: {publicKey},
                        },
                    }) => publicKey,
                ),
                // convert group to array
                scan((acc, curr) => [...acc, curr], [] as PacketInformation[]),
            ),
        ),
        // tap(informations =>
        //     console.log(JSON.stringify({informations}, undefined, 4)),
        // ),
    )
    // legitimate packets that have passed confidence threshold
    // subscribe to live updating qr code registry
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
        // get the position of the original packet
        // map(
        //     ([informations, registry]) =>
        //         [
        //             informations.map(information => ({
        //                 ...information,
        //                 qr: sensedQrCode(
        //                     registry,
        //                     Buffer.from(
        //                         information.packet.source.publicKey,
        //                         "hex",
        //                     ),
        //                     information.packet.source.timestamp,
        //                 ),
        //             })),
        //             registry,
        //         ] as const,
        // ),

        // calculate confidence scores
        map(([informations, registry]) => ({
            confidence: calculateConfidenceScoreMany(informations, registry),
            informations,
            original: informations[0].original,
        })),
        tap(({confidence, original}) => {
            console.log(
                `Packet with id ${original.source.id} has confidence ${inspect(
                    confidence,
                )}`,
            )
        }),
        // filter out packets that haven't met threshold
        filter(({confidence}) => confidence.score >= confidenceThreshold),
        // distinct based on original packet (i.e., don't re-process packets)
        distinct(({original: {source}}) => JSON.stringify(source)),
    )
    // packets that we have verified with our sensor information
    const rebroadcastablePackets = verifiedPackets.pipe(
        // mergeMap(packet => combineLatest(of(packet), qrCodes)),
        withLatestFrom(qrCodes),
        flatMap(([packet, registry]) => {
            // console.log(`Rebroadcastable? ${packet.source.id}`)
            const qr = sensedQrCode(
                registry,
                Buffer.from(packet.source.publicKey, "hex"),
                packet.source.timestamp,
            )
            if (!qr) {
                console.log(`Not sensed QR code for packet ${packet.source.id}`)
                return empty()
            }
            // else {
            //     console.log(`Have sensed qr code for ${packet.source.id}`)
            // }
            return of([packet, registry, qr] as const)
        }),
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

interface NewPacket {
    confidence: {score: number; confirmations: number}
    informations: PacketInformation[]
    original: Signed<BroadcastPacket>
}

const main = async () => {
    const {privateKey, publicKey} = await loadKeyPair()
    const mqttClient = await mqttMain()
    const connection = await commandsMain(mqttClient, {privateKey, publicKey})
    const onNewPacket = async ({
        confidence: {score: confidence, confirmations},
        informations,
        original,
    }: NewPacket) => {
        const duration = Date.now() - original.source.timestamp
        console.log(
            chalk`{green Received original ${
                original.source.id
            } with {blue ${confidence} confidence} and {blue ${confirmations} confirmations}, {red ${duration /
                1000}} seconds after it was posted.}`,
        )

        const getPositionChain = (
            packet: SignedPacket,
            currChain: Vector2[] = [],
        ): Vector2[] => {
            switch (packet.type) {
                case "broadcast":
                    return []
                case "rebroadcast":
                    return getPositionChain(packet.original, [
                        ...currChain,
                        packet.location,
                    ])
                default:
                    return unreachable()
            }
        }

        handleDemoPacket(
            connection,
            original,
            informations.map(({packet}) => getPositionChain(packet)),
        )
    }

    const {legitimatePackets, rebroadcastablePackets} = streamSetup({
        privateKey,
        publicKey,
    })

    rebroadcastablePackets.subscribe(([original, , {location}]) =>
        runAsync(async () => {
            console.log(
                chalk`{green Rebroadcasting packet ${original.source.id}}`,
            )

            await broadcastSignedMessage(
                mqttClient,
                {
                    source: {
                        id: uuid(),
                        publicKey: publicKey.toString("hex"),
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
        async ({confidence, informations, original}) => {
            const packetId = packetIdCalculator(original)
            if (processedPacketIds.has(packetId)) {
                console.log(
                    chalk`{red Packet ${original.source.id} has already been processed. Ignoring...}`,
                )
                return
            }
            if (confidence.confirmations > 1) {
                console.log(
                    chalk`{blue Packet ${original.source.id} has multiple confirmations!}`,
                )
            }

            processedPacketIds.add(packetId)

            await onNewPacket({confidence, informations, original})
        },
        error => console.log({error}),
    )

    await ipcMain()
}

main().catch(console.error)
