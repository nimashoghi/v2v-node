require("dotenv").config({path: process.argv[2] || undefined})

import crypto from "crypto"
import {
    combineLatest,
    MonoTypeOperatorFunction,
    range,
    timer,
    from,
    of,
} from "rxjs"
import {
    debounceTime,
    distinct,
    filter,
    groupBy,
    map,
    mergeMap,
    retryWhen,
    toArray,
    withLatestFrom,
    zip,
} from "rxjs/operators"
import uuid from "uuid/v4"
import {privateKey, publicKey, verify} from "./crypto"
import {broadcastSignedMessage, mqttMain, packetsSubject} from "./mqtt"
import {
    getQrCodeLocation,
    QrCodeRegistry,
    qrCodes,
    registry,
    sensedQrCode,
} from "./qr"
import {commandsMain, executeCommand} from "./robot"
import {
    confidenceThreshold,
    failureRetryDelay,
    maxNumRetries,
    packetExpirationDuration,
    sensingThreshold,
} from "./settings"
import {startSocketServer} from "./socketio"
import {
    BroadcastPacket,
    Packet,
    RebroadcastPacket,
    Signed,
    SignedPacket,
} from "./types"
import {assert, runAsync, unreachable} from "./util"

const processedPacketIds = new Set<string>()

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

const retryProcessing = <T>(messagePrefix = ""): MonoTypeOperatorFunction<T> =>
    retryWhen(attempts =>
        range(1, maxNumRetries).pipe(
            zip(attempts, i => i),
            mergeMap(i => {
                console.log(
                    `${messagePrefix} [RETRY #${i}] Waiting for ${failureRetryDelay /
                        1000} seconds and retrying`,
                )
                return timer(failureRetryDelay)
            }),
        ),
    )

interface PacketInformation {
    depth: number
    original: Signed<BroadcastPacket>
    packet: SignedPacket
}

const getPacketInformation = (packet: SignedPacket): PacketInformation => ({
    depth: getDepth(packet),
    original:
        packet.type === "rebroadcast" ? getOriginalPacket(packet) : packet,
    packet,
})
const nonExpiredPackets = packetsSubject.pipe(
    // ignore expired packets
    filter(({source: {id, timestamp}}) => {
        if (Date.now() - timestamp > packetExpirationDuration) {
            console.log(`Packet ${id} has already expired. Ignoring...`)
            return false
        }
        return true
    }),
)

const isMineAtAnyPoint = (packet: SignedPacket): boolean => {
    if (packet.source.publicKey === publicKey) {
        return true
    }
    return packet.type === "broadcast"
        ? false
        : isMineAtAnyPoint(packet.original)
}

// pipe out packets that are not mine
const nonMinePackets = nonExpiredPackets.pipe(
    filter(packet => !isMineAtAnyPoint(packet)),
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

const getDepth = (message: SignedPacket): number =>
    message.type === "broadcast" ? 1 : 1 + getDepth(message.original)

const calculateConfidenceScore = (
    values: PacketInformation[],
    qrCodeRegistry: QrCodeRegistry = registry,
) =>
    values
        .map(({depth, packet}) => {
            if (
                !sensedQrCode(
                    qrCodeRegistry,
                    packet.source.publicKey,
                    packet.source.timestamp,
                )
            ) {
                return [0, true] as const
            }
            console.log(
                `Successfully sensed the QR code for ${packet.source.id}`,
            )
            return [1 / depth, false] as const
        })
        .reduce(
            ({score, unsensed}, [currScore, currUnsensed]) => ({
                score: score + currScore,
                unsensed: unsensed || currUnsensed,
            }),
            {score: 0, unsensed: false},
        )

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
    await Promise.all([mqttMain(), startSocketServer(), commandsMain()])

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
                    source: newSource(publicKey),
                    type: "rebroadcast",
                    location,
                    original,
                },
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
