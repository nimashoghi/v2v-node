// @ts-ignore
import * as ed from "ed25519-supercop"
import {promises as fs} from "fs"
import {Packet, Signed} from "./types"
import {assertDefined} from "./util"

export interface KeyPair {
    privateKey: Buffer
    publicKey: Buffer
}

export const createKeyPair = (): KeyPair => {
    const {publicKey, secretKey} = ed.createKeyPair(ed.createSeed())
    return {publicKey, privateKey: secretKey}
}

export const loadKeyPair = async () => {
    const [privateKey, publicKey] = await Promise.all([
        fs.readFile(assertDefined(process.env.PRIVATE_KEY_LOCATION)),
        fs.readFile(assertDefined(process.env.PUBLIC_KEY_LOCATION)),
    ])
    return {privateKey, publicKey}
}

export const signPacket = <T extends Packet>(
    original: T,
    publicKey: Buffer,
    privateKey: Buffer,
): Signed<T> => ({
    ...original,
    signature: ed
        .sign(
            Buffer.from(JSON.stringify(original), "ascii"),
            publicKey,
            privateKey,
        )
        .toString("hex"),
})

export const verify = (message: Buffer, signature: Buffer, publicKey: Buffer) =>
    ed.verify(signature, message, publicKey)
