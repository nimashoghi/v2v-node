import * as MQTT from "async-mqtt"
import {Subject} from "rxjs"
import {KeyInput, signPacket} from "./crypto"
import {mqttHost, mqttSettings} from "./settings"
import {Packet, SignedPacket} from "./types"
import {assertDefined} from "./util"

const MY_TOPIC = assertDefined(process.env.MY_TOPIC)
const ALL_TOPICS = assertDefined(process.env.ALL_TOPICS)
    .split(",")
    .filter(topic => topic !== MY_TOPIC)

export const packetsSubject = new Subject<SignedPacket>()

const client = MQTT.connect(mqttHost)

export const broadcastMessage = async (packet: SignedPacket) => {
    await client.publish(MY_TOPIC, JSON.stringify(packet), {...mqttSettings})
}
export const broadcastSignedMessage = async <T extends Packet>(
    original: T,
    privateKey: KeyInput,
) => await broadcastMessage(signPacket<T>(original, privateKey) as SignedPacket)

export const mqttMain = async () => {
    console.log(`mqttMain`)

    client.on("message", (_, payload) =>
        packetsSubject.next(JSON.parse(payload.toString())),
    )
    await client.subscribe(ALL_TOPICS, {...mqttSettings})
}
