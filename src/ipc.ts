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
            const location = points
                .map(
                    ({x, y}) => [x / points.length, y / points.length] as const,
                )
                .reduce(
                    (prev, curr) =>
                        [curr[0] + prev[0], curr[1] + prev[1]] as const,
                )
            console.log(
                `Sensed new public key: ${{
                    location,
                    points,
                    publicKey: publicKeyBuffer.toString("hex"),
                }}`,
            )

            qrCodesSubject.next({
                location,
                publicKey: publicKeyBuffer,
            })
        }
    })
}
