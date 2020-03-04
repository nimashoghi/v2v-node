import {promises as fs} from "fs"
import net from "net"
import {Observable, ReplaySubject} from "rxjs"
import {Point, qrCodesSubject} from "./qr"

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
    console.log("ipcMain")

    const [observable] = await server(IPC_SOCKET_PATH())
    return observable.subscribe(buffer => {
        for (const chunk of buffer
            .toString()
            .split(";;;;")
            .map(value => value.trim())
            .filter(value => !!value)) {
            const {
                publicKey,
                points,
            }: {points: Point[]; publicKey: string} = JSON.parse(chunk)
            const publicKeyBuffer = Buffer.from(publicKey, "base64")
            const averagePoint = points
                .map(({x, y}) => ({
                    x: x / points.length,
                    y: y / points.length,
                }))
                .reduce((prev, curr) => ({
                    x: curr.x + prev.x,
                    y: curr.y + prev.y,
                }))
            console.log(
                `Sensed new public key: ${{
                    averagePoint,
                    points,
                    publicKey: publicKeyBuffer.toString("hex"),
                }}`,
            )

            qrCodesSubject.next({
                location: "CENTER",
                publicKey: publicKeyBuffer,
            })
        }
    })
}
