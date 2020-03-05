import {startMovement, stopMovement} from "../robot"
import {BroadcastPacket, Signed} from "../types"
import {assert} from "../util"

export const handleDemoPacketStop = async (packet: Signed<BroadcastPacket>) => {
    assert(packet.event.type === "command")
    switch (packet.event.direction) {
        case "stop":
            stopMovement()
            break
        default:
            startMovement()
            break
    }
}
