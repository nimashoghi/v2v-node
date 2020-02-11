import io from "socket.io"
import {normalizeCode} from "./crypto"
import {qrCodesSubject} from "./qr"
import {receivedCommandSubject} from "./robot"
import {socketServerPort} from "./settings"
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

export const socketMain = async () => {
    console.log(`Starting socket server on port ${socketServerPort}`)

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

        socket.on(
            "commands",
            (message: SocketCommandMessage) =>
                void receivedCommandSubject.next(message),
        )
    })

    server.listen(socketServerPort)
    console.log(`opened qr code server on port ${socketServerPort}`)
}
