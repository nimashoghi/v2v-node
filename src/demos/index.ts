import SerialPort from "serialport"
import {BroadcastPacket, Signed, Vector2} from "../types"
import {assertDefined, unreachable} from "../util"
import {handleDemoPacketCopy} from "./copy-command"
import {handleDemoPacketStop} from "./stop"

export const handleDemoPacket = async (
    connection: SerialPort,
    packet: Signed<BroadcastPacket>,
    positions: Vector2[][],
) => {
    console.log({positions})

    switch (assertDefined(process.env.DEMO).toLowerCase()) {
        case "copy":
            await handleDemoPacketCopy(connection, packet)
            break
        case "stop":
            await handleDemoPacketStop(packet)
            break
        default:
            unreachable()
    }
}
