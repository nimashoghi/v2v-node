import {AsyncMqttClient} from "async-mqtt"
import struct = require("python-struct")
import {map} from "rxjs/operators"
import SerialPort from "serialport"
import uuid from "uuid/v4"
import {KeyPair} from "./crypto"
import {arrowKeyListener, Key} from "./keypress"
import {broadcastSignedMessage} from "./mqtt"
import {unreachable} from "./util"

const sendStartSequence = async (connection: SerialPort) => {
    await executeCommand(connection, Buffer.from([0x80])) // PASISVE mode
    await executeCommand(connection, Buffer.from([0x84])) // FULL mode
}

const beep = async (connection: SerialPort) => {
    await executeCommand(
        connection,
        Buffer.from([0x8c, 0x3, 0x1, 0x40, 0x10, 0x8d, 0x3]),
    )
}

export const executeCommand = async (
    connection: SerialPort,
    command: Buffer,
) => {
    console.log(`Executing command ${command}`)

    await new Promise<number>((resolve, reject) =>
        connection.write(command, (error, bytesWritten) => {
            if (error) {
                reject(error)
            } else {
                resolve(bytesWritten)
            }
        }),
    )
}

const pack = (velocity: number, rotation: number) =>
    struct.pack(">Bhh", 0x91, velocity + rotation / 2, velocity - rotation / 2)

const VELOCITY_CHANGE = 200
const ROTATION_CHANGE = 300

const getPacketData = (key: Key) => {
    switch (key) {
        case "down":
            return pack(-VELOCITY_CHANGE, 0)
        case "left":
            return pack(VELOCITY_CHANGE, ROTATION_CHANGE)
        case "right":
            return pack(VELOCITY_CHANGE, -ROTATION_CHANGE)
        case "space":
            return Buffer.from([0x8c, 0x3, 0x1, 0x40, 0x10, 0x8d, 0x3])
        case "up":
            return pack(VELOCITY_CHANGE, 0)
        default:
            return unreachable()
    }
}

export const commandsMain = async (
    client: AsyncMqttClient,
    {publicKey, privateKey}: KeyPair,
) => {
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

            await sendStartSequence(connection)
            await beep(connection)
        },
    )
    console.log(`commandsMain called`)

    arrowKeyListener()
        .pipe(map(key => getPacketData(key)))
        .subscribe(async command => {
            await executeCommand(connection, command)

            await broadcastSignedMessage(
                client,
                {
                    type: "broadcast",
                    event: {type: "movement", command: command.toString("hex")},
                    source: {
                        id: uuid(),
                        publicKey: publicKey.toString("hex"),
                        timestamp: Date.now(),
                    },
                },
                publicKey,
                privateKey,
            )
        })

    return connection
}
