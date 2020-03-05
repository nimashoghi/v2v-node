import SerialPort from "serialport"
import {executeCommand} from "../robot"
import {BroadcastPacket, Signed} from "../types"

export const handleDemoPacketCopy = async (
    connection: SerialPort,
    packet: Signed<BroadcastPacket>,
) => {
    if (packet.event.type === "command") {
        await executeCommand(
            connection,
            Buffer.from(packet.event.command, "hex"),
        )
    }
}
