import chalk from "chalk"
import uuid from "uuid/v4"
import {createKeyPair, KeyPair, signPacket} from "./crypto"
import {packetsSubject} from "./mqtt"
import {qrCodesSubject} from "./qr"
import {packetExpirationDuration} from "./settings"
import {Packet, RebroadcastPacket, Signed, SignedPacket} from "./types"
import {sleep} from "./util"

const getConfirmations = (
    original: {packet: Signed<Packet>; other: KeyPair},
    count: number,
) => {
    const confirmations: {
        other: KeyPair
        packet: Signed<RebroadcastPacket>
    }[] = []
    for (let i = 0; i < count; ++i) {
        const other = createKeyPair()
        const packet = signPacket(
            {
                type: "rebroadcast",
                original: original.packet,
                location: "CENTER",
                source: {
                    id: uuid(),
                    publicKey: other.publicKey,
                    timestamp: Date.now(),
                },
            },
            other.publicKey,
            other.privateKey,
        )
        confirmations.push({other, packet})
    }
    return confirmations
}

const getNewPacket = () => {
    const other = createKeyPair()
    const source: SignedPacket["source"] = {
        id: uuid(),
        publicKey: other.publicKey,
        timestamp: Date.now(),
    }
    const packet = signPacket(
        {
            type: "broadcast",
            event: {type: "movement", command: "sup"},
            source,
        },
        other.publicKey,
        other.privateKey,
    )
    return {packet, other}
}

const getNewPacketWithConfirmations = (count: number) => {
    const original = getNewPacket()
    return {confirmations: getConfirmations(original, count), original}
}

const senseAfterRecvSuccess = async () => {
    const {other, packet} = getNewPacket()

    packetsSubject.next(packet)

    await sleep(2000)

    qrCodesSubject.next({
        location: "CENTER",
        publicKey: other.publicKey,
    })
}

const senseBeforeRecvSuccess = async () => {
    const {other, packet} = getNewPacket()

    qrCodesSubject.next({
        location: "CENTER",
        publicKey: other.publicKey,
    })

    await sleep(2000)

    packetsSubject.next(packet)
}

const senseAfterRecvFailure = async () => {
    const {packet, other} = getNewPacket()
    packetsSubject.next(packet)

    await sleep(packetExpirationDuration * 2)

    qrCodesSubject.next({
        location: "CENTER",
        publicKey: other.publicKey,
    })
}

const senseBeforeRecvFailure = async () => {
    const {other, packet} = getNewPacket()

    qrCodesSubject.next({
        location: "CENTER",
        publicKey: other.publicKey,
    })

    await sleep(packetExpirationDuration * 2)

    packetsSubject.next(packet)
}

const senseWithConfirmations = async () => {
    const {confirmations, original} = getNewPacketWithConfirmations(2)

    packetsSubject.next(original.packet)

    await sleep(2000)

    for (const {other, packet} of confirmations) {
        packetsSubject.next(packet)
        qrCodesSubject.next({
            location: "CENTER",
            publicKey: other.publicKey,
        })
    }
}

const senseWithConfirmationsDeep = async () => {
    const {
        confirmations: [confirmation],
        original,
    } = getNewPacketWithConfirmations(1)
    const confirmations = getConfirmations(confirmation, 4)

    packetsSubject.next(original.packet)

    await sleep(2000)

    for (const {other, packet} of confirmations) {
        packetsSubject.next(packet)
        qrCodesSubject.next({
            location: "CENTER",
            publicKey: other.publicKey,
        })
    }
}

const senseWithConfirmationsDeepFailure = async () => {
    const {
        confirmations: [confirmation],
        original,
    } = getNewPacketWithConfirmations(1)
    const [delayed, ...confirmations] = getConfirmations(confirmation, 4)

    packetsSubject.next(original.packet)

    await sleep(2000)

    for (const {other, packet} of confirmations) {
        packetsSubject.next(packet)
        qrCodesSubject.next({
            location: "CENTER",
            publicKey: other.publicKey,
        })
    }

    await sleep(packetExpirationDuration * 2)
    packetsSubject.next(delayed.packet)
    qrCodesSubject.next({
        location: "CENTER",
        publicKey: delayed.other.publicKey,
    })
}

export const setupMockData = async () => {
    // console.log(chalk`{red senseBeforeRecvSuccess}`)
    // await senseBeforeRecvSuccess()

    // await sleep(2000)

    // console.log(chalk`{red senseAfterRecvSuccess}`)
    // await senseAfterRecvSuccess()

    // await sleep(2000)

    // console.log(chalk`{red senseBeforeRecvFailure}`)
    // await senseBeforeRecvFailure()

    // await sleep(2000)

    // console.log(chalk`{red senseAfterRecvFailure}`)
    // await senseAfterRecvFailure()

    // await sleep(2000)

    // console.log(chalk`{red senseWithConfirmations}`)
    // await senseWithConfirmations()

    // await sleep(2000)

    // console.log(chalk`{red senseWithConfirmationsDeep}`)
    // await senseWithConfirmationsDeep()

    // await sleep(2000)

    console.log(chalk`{red senseWithConfirmationsDeepFailure}`)
    await senseWithConfirmationsDeepFailure()
}
