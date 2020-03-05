import {startMovement, stopMovement} from "../robot"
import {BroadcastPacket, Signed} from "../types"

export const handleDemoPacketStop = async (packet: Signed<BroadcastPacket>) => {
    switch (packet.event.type) {
        case "command":
            startMovement()
            break
        case "stop":
            stopMovement()
            break
    }
}
