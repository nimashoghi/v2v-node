import * as MQTT from "async-mqtt"
import {Subject} from "rxjs"
import {signPacket} from "./crypto"
import {mqttSettings} from "./settings"
import {Packet, SignedPacket} from "./types"
import {assertDefined} from "./util"

const HOST = assertDefined(process.env.MQTT_HOST)
const MY_TOPIC = assertDefined(process.env.MY_TOPIC)
const ALL_TOPICS = assertDefined(process.env.ALL_TOPICS)
    .split(",")
    .filter(topic => topic !== MY_TOPIC)

export const packetsSubject = new Subject<SignedPacket>()
export const packetsObservable = packetsSubject.pipe()

const client = MQTT.connect(HOST)

export const broadcastSignedMessage = async <T extends Packet>(
    original: T,
    publicKey: Buffer,
    privateKey: Buffer,
) =>
    await client.publish(
        MY_TOPIC,
        JSON.stringify(signPacket<T>(original, publicKey, privateKey)),
        {...mqttSettings},
    )

export const mqttMain = async () => {
    client.on("message", (_, payload) =>
        packetsSubject.next(JSON.parse(payload.toString())),
    )
    client.subscribe(ALL_TOPICS, {...mqttSettings})
}
