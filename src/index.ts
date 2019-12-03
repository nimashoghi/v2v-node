require("dotenv").config({path: process.argv[2] || undefined})

import crypto from "crypto"
import {MonoTypeOperatorFunction, range, timer} from "rxjs"
import {
    debounceTime,
    filter,
    groupBy,
    map,
    mergeMap,
    retryWhen,
    scan,
    shareReplay,
    withLatestFrom,
    zip,
} from "rxjs/operators"
import uuid from "uuid/v4"
import {privateKey, publicKey, verify} from "./crypto"
import {broadcastSignedMessage, packets} from "./mqtt"
import {
    getQrCodeLocation,
    QrCodeRegistry,
    qrCodes,
    registry,
    sensedQrCode,
} from "./qr"
import {executeCommand} from "./robot"
import {confidenceThreshold} from "./settings"
import {
    BroadcastPacket,
    Packet,
    RebroadcastPacket,
    Signed,
    SignedPacket,
} from "./types"
import {assert, removeDuplicates, runAsync, unreachable} from "./util"

const verifyPacket = ({signature, ...packet}: SignedPacket) =>
    verify(
        JSON.stringify(packet),
        Buffer.from(signature, "base64"),
        packet.source.publicKey,
    )

const getOriginalPacket = (
    packet: Signed<RebroadcastPacket>,
): Signed<BroadcastPacket> => {
    assert(verifyPacket(packet))

    switch (packet.original.type) {
        case "broadcast":
            return packet.original
        case "rebroadcast":
            return getOriginalPacket(packet.original)
        default:
            return unreachable()
    }
}

const packetIdCalculator = (packet: SignedPacket) => {
    const groupingPacket =
        packet.type === "broadcast" ? packet : getOriginalPacket(packet)
    return `${groupingPacket.type}-${JSON.stringify(groupingPacket.source)}`
}

const getOriginalPacketFromList = ([...packets]: SignedPacket[]) => {
    const [packet, index] = packets
        .map((packet, i) => [packet, i] as const)
        .find(([packet]) => packet.type === "broadcast") ?? [undefined, 0]
    assert(packet?.type === "broadcast")
    packets.splice(index, 1)
    assert(packets.every(packet_ => packet_.type === "rebroadcast"))

    return [packet, packets as Signed<RebroadcastPacket>[]] as const
}

const retryProcessing = <T>(messagePrefix = ""): MonoTypeOperatorFunction<T> =>
    retryWhen(attempts =>
        range(1, 5).pipe(
            zip(attempts, i => {
                return i
            }),
            mergeMap(i => {
                console.log(messagePrefix + "Waiting for 1 second and retrying")
                return timer(1000)
            }),
        ),
    )

const verifiedPackets = packets.pipe(
    // tap(packet => console.log({packet})),
    filter(packet => verifyPacket(packet)),
)
const legitimatePackets = verifiedPackets.pipe(
    groupBy(packetIdCalculator, undefined, grouped =>
        grouped.pipe(debounceTime(1500)),
    ),
    mergeMap(obs =>
        obs.pipe(
            // filter out our messages
            filter(
                packet =>
                    !(
                        packet.type === "rebroadcast" &&
                        packet.original.source.publicKey === publicKey
                    ),
            ),
            shareReplay(),
            scan(
                (acc, packet) => [...acc, packet] as SignedPacket[],
                [] as SignedPacket[],
            ),
            // remove duplicate entries in groups
            map(packets =>
                removeDuplicates(packets, packet => packetIdCalculator(packet)),
            ),
            map(packets => {
                const [packet, rebroadcasts] = getOriginalPacketFromList(
                    packets,
                )
                return [
                    packet,
                    rebroadcasts,
                    calculateConfidenceScore(packet, packets),
                ] as const
            }),
            filter(
                ([
                    {
                        source: {id},
                    },
                    ,
                    [score, unsensed],
                ]) => {
                    console.log(
                        `Calculated the following score for packet ${id}: ${score}`,
                    )
                    if (score < confidenceThreshold) {
                        if (unsensed) {
                            console.log(
                                `Received packet with low confidence, but we have not verified all QR codes. Waiting...`,
                            )
                            throw new Error()
                        }

                        console.log(
                            `Received packet with low confidence. Ignoring`,
                        )
                        return false
                    }
                    return true
                },
            ),
            retryProcessing("[Processing] "),
        ),
    ),
)

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

const onNewPacket = async (
    packet: Signed<BroadcastPacket>,
    _: Signed<RebroadcastPacket>[],
) => {
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

const getDepth = (message: SignedPacket): number =>
    message.type === "broadcast" ? 1 : 1 + getDepth(message.original)

const calculateConfidenceScore = (
    originalPacket: Signed<BroadcastPacket>,
    values: SignedPacket[],
    qrCodeRegistry: QrCodeRegistry = registry,
) => {
    const originalPacketId = packetIdCalculator(originalPacket)
    return values
        .filter(packet => {
            if (packetIdCalculator(packet) !== originalPacketId) {
                console.log(
                    `The id of packet ${packet} did not match the original broadcast ID. Skipping in confidence score calculation.`,
                )
                return false
            }
            return true
        })
        .map(message => {
            if (
                !sensedQrCode(
                    qrCodeRegistry,
                    message.source.publicKey,
                    message.source.timestamp,
                )
            ) {
                return [0, true] as const
            }
            console.log(
                `Successfully sensed the QR code for ${message.source.id}`,
            )
            return [1 / getDepth(message), false] as const
        })
        .reduce(
            ([accScore, accUnsensed], [currScore, currUnsensed]) =>
                [accScore + currScore, accUnsensed || currUnsensed] as [
                    number,
                    boolean,
                ],
            [0, false] as [number, boolean],
        )
}

const newSource = (publicKey: string) => ({
    id: uuid(),
    publicKey,
    timestamp: Date.now(),
})

const isRebroadcastOfMyPacket = (packet: SignedPacket, publicKey: string) =>
    packet.type === "rebroadcast" &&
    crypto.createPublicKey(packet.original.source.publicKey) ===
        crypto.createPublicKey(publicKey)

const main = async () => {
    console.log(`Started`)

    verifiedPackets
        .pipe(
            // filter out messages that are rebroadcasts of packets from me
            filter(packet => !isRebroadcastOfMyPacket(packet, publicKey)),
            withLatestFrom(qrCodes),
            filter(([packet, registry]) => {
                if (
                    !sensedQrCode(
                        registry,
                        packet.source.publicKey,
                        packet.source.timestamp,
                    )
                ) {
                    console.log(
                        "Received a packet whose identity QR code we have not sensed yet.",
                    )
                    throw new Error()
                }
                return true
            }),
            retryProcessing("[Rebroadcasting] "),
        )
        .subscribe(([original, registry]) =>
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
                        source: newSource(publicKey),
                        type: "rebroadcast",
                        location,
                        original,
                    },
                    privateKey,
                )
            }),
        )

    const processed = new Set<string>()
    legitimatePackets.subscribe(
        async ([packet, rebroadcasts]) => {
            console.log(packet)
            const packetId = packetIdCalculator(packet)
            if (processed.has(packetId)) {
                console.log(
                    `Received a packet with id ${packetId} that has already been processed. Ignoring...`,
                )
                return
            }
            processed.add(packetId)

            await onNewPacket(packet, rebroadcasts)
        },
        error => console.log({error}),
    )

    // const simulations = await getAllSimulations()
    // simulations
    //     .pipe(
    //         flatMap(async event => {
    //             console.log(
    //                 `Broadcasting the following event: ${JSON.stringify(
    //                     event,
    //                 )}`,
    //             )
    //             await broadcastSignedMessage(
    //                 {
    //                     type: "broadcast",
    //                     event,
    //                     source: newSource(publicKey),
    //                 },
    //                 privateKey,
    //             )
    //         }),
    //     )
    //     .subscribe(() => {})
}

main().catch(console.error)
