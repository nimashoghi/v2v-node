import {promises as fs} from "fs"
import net from "net"
import {Observable, ReplaySubject, range, interval} from "rxjs"
import {map} from "rxjs/operators"
import {QrCode, qrCodesSubject} from "./qr"
import {ObjectLocation} from "./types"

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

const getKeys = async () =>
    await Promise.all(
        Array.from(Array(5)).map(
            async (_, i) => await fs.readFile(`./keys/${i}-public.bin`),
        ),
    )

const getRandomElement = <T>(array: T[]) =>
    array[Math.floor(Math.random() * array.length)]

export const ipcMain = async () => {
    const locations: ObjectLocation[] = ["CENTER", "LEFT", "RIGHT"]
    const keys = await getKeys()

    const observable = interval(1000).pipe(
        map(
            () =>
                ({
                    publicKey: getRandomElement(keys),
                    location: getRandomElement(locations),
                } as QrCode),
        ),
    )
    return observable.subscribe(qrCode => qrCodesSubject.next(qrCode))
}
