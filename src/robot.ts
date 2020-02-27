import {Subject} from "rxjs"
import SerialPort from "serialport"
import uuid from "uuid/v4"
import {KeyPair} from "./crypto"
import {broadcastSignedMessage} from "./mqtt"

const commands = {
    BEEP: [0x8c, 0x3, 0x1, 0x40, 0x10, 0x8d, 0x3],
    FULL: [0x84],
    PASSIVE: [0x80],
}

const sendStartSequence = async () => {
    await executeCommand(commands.PASSIVE)
    await executeCommand(commands.FULL)
}

const beep = async () => {
    await executeCommand(commands.BEEP)
}
const connection = new SerialPort(
    process.env.ROBOT_SERIAL ?? "/dev/ttyUSB0",
    {
        baudRate: parseInt(process.env.ROBOT_BAUD ?? "115200"),
    },
    async error => {
        if (error) {
            console.error(
                `Got the following error when intializing SerialPort: ${error}`,
            )
            return
        }

        await sendStartSequence()
        await beep()
    },
)

export const receivedCommandSubject = new Subject<SocketCommandMessage>()

export const executeCommand = async (command: string | Buffer | number[]) => {
    const buffer =
        typeof command === "string" ? Buffer.from(command, "base64") : command
    console.log(`Executing command ${buffer}`)

    await new Promise<number>((resolve, reject) =>
        connection.write(buffer, (error, bytesWritten) => {
            if (error) {
                reject(error)
            } else {
                resolve(bytesWritten)
            }
        }),
    )
}

export const commandsMain = async ({publicKey, privateKey}: KeyPair) => {
    console.log(`commandsMain called`)

    receivedCommandSubject.subscribe(async ({command}) => {
        await broadcastSignedMessage(
            {
                type: "broadcast",
                event: {type: "movement", command},
                source: {id: uuid(), publicKey, timestamp: Date.now()},
            },
            publicKey,
            privateKey,
        )
    })
}
