import {assert} from "console"
import {verify} from "./crypto"
import {QrCodeRegistry, registry, sensedQrCode} from "./qr"
import {
    BroadcastPacket,
    PacketInformation,
    RebroadcastPacket,
    Signed,
    SignedPacket,
} from "./types"
import {unreachable} from "./util"

export const verifyPacket = ({signature, ...packet}: SignedPacket) =>
    verify(
        Buffer.from(JSON.stringify(packet), "ascii"),
        signature,
        packet.source.publicKey,
    )

export const getDepth = (message: SignedPacket): number =>
    message.type === "broadcast" ? 0 : 1 + getDepth(message.original)

export const calculateConfidenceScore = (
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
            return [1 / 2 ** depth, false] as const
        })
        .reduce(
            ({confirmations, score, unsensed}, [currScore, currUnsensed]) => ({
                confirmations: confirmations + (currScore === 0 ? 0 : 1),
                score: score + currScore,
                unsensed: unsensed || currUnsensed,
            }),
            {confirmations: 0, score: 0, unsensed: false},
        )

export const getOriginalPacket = (
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

export const packetIdCalculator = (packet: SignedPacket) => {
    const groupingPacket =
        packet.type === "broadcast" ? packet : getOriginalPacket(packet)
    return `${groupingPacket.type}-${JSON.stringify(groupingPacket.source)}`
}

// filter out packet chains that contain me
export const isMineAtAnyPoint = (
    packet: SignedPacket,
    publicKey: Buffer,
): boolean => {
    if (packet.source.publicKey === publicKey) {
        return true
    }
    return packet.type === "broadcast"
        ? false
        : isMineAtAnyPoint(packet.original, publicKey)
}

export const getPacketInformation = (
    packet: SignedPacket,
): PacketInformation => ({
    depth: getDepth(packet),
    original:
        packet.type === "rebroadcast" ? getOriginalPacket(packet) : packet,
    packet,
})
