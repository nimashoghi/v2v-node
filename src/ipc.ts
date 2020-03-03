import {promises as fs} from "fs"
import net from "net"
import {Observable, ReplaySubject} from "rxjs"
import {qrCodesSubject} from "./qr"

const IPC_SOCKET_PATH = () => process.env.IPC_SOCKET_PATH ?? "/v2v/server.sock"

const server = async (filePath: string) => {
    try {
        await fs.stat(filePath)
        await fs.unlink(filePath)
    } catch {}

    const subject = new ReplaySubject<Buffer>()
    const observable = new Observable<Buffer>(observer => {
        const server = net.createServer(socket => {
            socket.on("data", data => observer.next(data))
        })
        server.on("connection", socket => {
            console.log("connected")
            const subscription = subject.subscribe(value => socket.write(value))
            socket.on("close", () => {
                console.log("disconnected")
                subscription.unsubscribe()
            })
        })
        server.on("close", () => observer.complete())
        server.listen(filePath, () => console.log("Started socket server!"))
    })
    return [observable, subject] as const
}

export const ipcMain = async () => {
    const [observable] = await server(IPC_SOCKET_PATH())
    return observable.subscribe(publicKey => {
        qrCodesSubject.next({
            location: "CENTER",
            publicKey,
        })
    })
}
