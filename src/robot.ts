import {AsyncMqttClient} from "async-mqtt"
import {combineLatest, merge} from "rxjs"
import {debounceTime, filter, map, publish, startWith} from "rxjs/operators"
import SerialPort from "serialport"
import uuid from "uuid/v4"
import {KeyPair} from "./crypto"
import {arrowKeyListener, Key} from "./keypress"
import {broadcastSignedMessage} from "./mqtt"
import {unreachable} from "./util"
import struct = require("python-struct")

let canMove = true
export const stopMovement = () => {
    setTimeout(() => {
        canMove = false
    }, parseFloat(process.env.STOP_MOVEMENT_DELAY ?? "0"))
}
export const startMovement = () => {
    setTimeout(() => {
        canMove = true
    }, parseFloat(process.env.START_MOVEMENT_DELAY ?? "0"))
}

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
    console.log(`Executing command ${command.toString("hex")}`)

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

const packMovementData = (velocity: number, rotation: number) =>
    struct.pack(">Bhh", 0x91, velocity + rotation / 2, velocity - rotation / 2)

const VELOCITY_CHANGE = 200
const ROTATION_CHANGE = 300

const getPacketData = (key: Key | "stop", lastKey: "up" | "down") => {
    switch (key) {
        case "down":
            return packMovementData(-VELOCITY_CHANGE, 0)
        case "left":
            return packMovementData(
                (lastKey === "down" ? -1 : 1) * VELOCITY_CHANGE,
                ROTATION_CHANGE,
            )
        case "right":
            return packMovementData(
                (lastKey === "down" ? -1 : 1) * VELOCITY_CHANGE,
                -ROTATION_CHANGE,
            )
        case "space":
            return Buffer.from([0x8c, 0x3, 0x1, 0x40, 0x10, 0x8d, 0x3])
        case "up":
            return packMovementData(VELOCITY_CHANGE, 0)
        case "stop":
            return packMovementData(0, 0)
        default:
            return unreachable()
    }
}

export const commandsMain = async (
    client: AsyncMqttClient,
    {publicKey, privateKey}: KeyPair,
) => {
    const newSource = () => ({
        id: uuid(),
        publicKey: publicKey.toString("hex"),
        timestamp: Date.now(),
    })

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

    const obs = arrowKeyListener()
    obs.pipe(
        publish(observable =>
            combineLatest(
                merge(
                    observable,
                    observable.pipe(
                        debounceTime(100),
                        map(() => "stop" as const),
                    ),
                ),
                observable.pipe(
                    filter(key => key === "down" || key === "up"),
                    map(key => key as "down" | "up"),
                    startWith("up" as const),
                ),
            ),
        ),
        map(([key, last]) => [getPacketData(key, last), key] as const),
    ).subscribe(async ([command, direction]) => {
        if (!canMove && direction !== "stop") {
            console.log("canMove is false. Ignoring movement command!")
            return
        }

        await executeCommand(connection, command)

        switch (direction) {
            case "space":
                break
            case "stop":
                await Promise.all([
                    broadcastSignedMessage(
                        client,
                        {
                            type: "broadcast",
                            event: {type: "stop"},
                            source: newSource(),
                        },
                        publicKey,
                        privateKey,
                    ),
                    broadcastSignedMessage(
                        client,
                        {
                            type: "broadcast",
                            event: {
                                command: command.toString("hex"),
                                direction,
                                type: "command",
                            },
                            source: newSource(),
                        },
                        publicKey,
                        privateKey,
                    ),
                ])
                break
            default:
                await broadcastSignedMessage(
                    client,
                    {
                        type: "broadcast",
                        event: {
                            command: command.toString("hex"),
                            direction,
                            type: "command",
                        },
                        source: newSource(),
                    },
                    publicKey,
                    privateKey,
                )
                break
        }
    })

    return connection
}
