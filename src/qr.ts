import {Subject} from "rxjs"
import {scan, startWith, tap} from "rxjs/operators"
import io from "socket.io"
import uuid from "uuid/v4"
import {privateKey, publicKey} from "./crypto"
import {broadcastSignedMessage} from "./mqtt"
import {qrCodeServerPort, sensingThreshold} from "./settings"
import {ObjectLocation} from "./types"

export interface QrCode {
    location: ObjectLocation
    publicKey: string
}

export interface SocketCommandMessage {
    command: string
}

export interface SocketQrMessage {
    codes: QrCode[]
}

export interface QrCodeInformation extends QrCode {
    sensedAt: number
}

export interface QrCodeRegistry {
    [qrCode: string]: QrCodeInformation | undefined
}

export let registry: QrCodeRegistry = {}

export const qrCodesSubject = new Subject<QrCode>()
export const qrCodes = qrCodesSubject.pipe(
    tap(({location, publicKey}) =>
        console.log(
            `Sensed the following code to the ${location}: ${publicKey.slice(
                0,
                25,
            )}...`,
        ),
    ),
    scan(
        (acc, curr) => ({
            ...acc,
            [curr.publicKey]: {...curr, sensedAt: Date.now()},
        }),
        {} as QrCodeRegistry,
    ),
    startWith({}),
    tap(registry_ => void (registry = registry_)),
)

const server = io()

server.on("connection", socket => {
    console.log("connection")
    socket.on("qr-codes", ({codes}: SocketQrMessage) => {
        for (const code of codes) {
            qrCodesSubject.next({
                ...code,
                publicKey: normalizeCode(code.publicKey),
            })
        }
    })

    socket.on("commands", async ({command}: SocketCommandMessage) => {
        await broadcastSignedMessage(
            {
                type: "broadcast",
                event: {type: "movement", command},
                source: {id: uuid(), publicKey, timestamp: Date.now()},
            },
            privateKey,
        )
    })
})

server.listen(qrCodeServerPort)
console.log(`opened qr code server on port ${qrCodeServerPort}`)

const normalizeCode = (code: string) => code.replace(/(\r\n|\n|\r)/gm, "")

export const sensedQrCode = (
    registry: QrCodeRegistry,
    code_: string,
    timestamp: number,
) => {
    const code = normalizeCode(code_)
    const sensedAt = registry[code]?.sensedAt
    if (!sensedAt) {
        console.log(`We have not sensed code ${code} at all!`)
        return false
    } else if (Math.abs(sensedAt - timestamp) > sensingThreshold) {
        console.log(
            `We have sensed the packet ${(Math.abs(sensedAt - timestamp) -
                sensingThreshold) /
                1000} seconds too late!`,
        )
        return false
    }
    return true
}

export const getQrCodeLocation = (registry: QrCodeRegistry, code: string) => {
    return registry[normalizeCode(code)]?.location
}
