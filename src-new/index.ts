import MQTT from "async-mqtt"
import {reduce, map} from "rxjs/operators"
import {sensedSources} from "./globals"
import {packets, sensed} from "./subjects"
import {Packet, SenseEvent} from "./types"

const sensedObjects = sensed.pipe(
    reduce(
        (acc, curr) => ({...acc, [curr.id]: curr}),
        {} as Partial<Record<string, SenseEvent>>,
    ),
)

const parsedPackets = packets.pipe(map(([id, packet]) => {}))

const handleNewPacket = async (packet: Packet, trial = 0): Promise<void> => {
    if (trial >= MAX_TRIALS()) {
        console.log("max trials")
        return
    }

    const {
        source: {id, timestamp},
    } = packet

    const sensed = sensedSources[id]
    if (!sensed || sensed.timestamp - timestamp > MAX_ALLOWED_TIMESTAMP()) {
        await handleNewPacket(packet, ++trial)
        return
    }
}

const client = MQTT.connect(process.env.MQTT_HOST)
client.on("message", (topic, payload, packet) => handleNewPacket(null as any))
