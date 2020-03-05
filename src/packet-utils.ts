import {assert} from "console"
import {verify} from "./crypto"
import {QrCodeRegistry, sensedQrCode} from "./qr"
import {
    BroadcastPacket,
    PacketInformation,
    RebroadcastPacket,
    Signed,
    SignedPacket,
} from "./types"
import {unreachable} from "./util"

export const verifyPacket = ({signature, ...packet}: SignedPacket) => {
    return verify(
        Buffer.from(JSON.stringify(packet), "ascii"),
        Buffer.from(signature, "hex"),
        Buffer.from(packet.source.publicKey, "hex"),
    )
}

export const getDepth = (message: SignedPacket): number =>
    message.type === "broadcast" ? 1 : 1 + getDepth(message.original)

export const calculateConfidenceScoreMany = (
    values: PacketInformation[],
    registry: QrCodeRegistry,
) =>
    values
        .map(({depth, packet}) => {
            if (
                !sensedQrCode(
                    registry,
                    Buffer.from(packet.source.publicKey, "hex"),
                    packet.source.timestamp,
                )
            ) {
                return 0
            }

            console.log(
                `Successfully sensed the QR code for ${packet.source.id}`,
            )
            return 1 / depth
        })
        .reduce(
            ({confirmations, score}, currScore) => ({
                confirmations: confirmations + (currScore === 0 ? 0 : 1),
                score: score + currScore,
            }),
            {confirmations: 0, score: 0},
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

export const packetIdCalculator = (packet: SignedPacket, original = true) => {
    const groupingPacket =
        packet.type === "broadcast" || !original
            ? packet
            : getOriginalPacket(packet)
    return `${groupingPacket.type}-${JSON.stringify(groupingPacket.source)}`
}

// filter out packet chains that contain me
export const isMineAtAnyPoint = (
    packet: SignedPacket,
    publicKey: Buffer,
): boolean => {
    if (packet.source.publicKey === publicKey.toString("hex")) {
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
