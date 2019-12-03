import crypto from "crypto"
import {promises as fs, readFileSync} from "fs"
import {settings} from "./settings"
import {Packet, Signed} from "./types"
import {assertDefined} from "./util"

export const normalizeCode = (code: string) =>
    code.replace(/(\r\n|\n|\r)/gm, "")

export const loadKeyPair = () => ({
    privateKey: crypto
        .createPrivateKey(
            readFileSync(assertDefined(process.env.PRIVATE_KEY_LOCATION)),
        )
        .export({format: "pem", type: "pkcs1"})
        .toString()
        .replace(/\\n/g, ""),
    publicKey: crypto
        .createPublicKey(
            readFileSync(assertDefined(process.env.PUBLIC_KEY_LOCATION)),
        )
        .export({format: "pem", type: "pkcs1"})
        .toString()
        .replace(/\\n/g, ""),
})

export const {privateKey, publicKey} = loadKeyPair()

const encodeMessage = (message: string) =>
    Buffer.from(message, settings.encoding)

export type KeyInput = string | crypto.KeyObject
const convertKeyInput = (input: KeyInput, type: "private" | "public") => {
    if (typeof input === "string") {
        return type === "private"
            ? crypto.createPrivateKey(input)
            : crypto.createPublicKey(input)
    }
    return input
}

export const sign = (message: string, key: KeyInput) =>
    crypto
        .sign(
            settings.algorithm,
            encodeMessage(message),
            convertKeyInput(key, "private"),
        )
        .toString("base64")

export const signPacket = <T extends Packet>(
    original: T,
    privateKey: KeyInput,
): Signed<T> => ({
    ...original,
    signature: sign(JSON.stringify(original), privateKey),
})

export const verify = (message: string, signature: Buffer, key: KeyInput) =>
    !!crypto.verify(
        settings.algorithm,
        encodeMessage(message),
        convertKeyInput(key, "public"),
        signature,
    )
