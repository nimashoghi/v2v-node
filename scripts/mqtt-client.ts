import * as MQTT from "async-mqtt"
import {ReplaySubject} from "rxjs"
import {KeyInput, signPacket} from "../src/crypto"
import {Packet, SignedPacket} from "../src/types"

const MY_TOPIC = "2"
const ALL_TOPICS = "0,1,2,3".split(",").filter(topic => topic !== MY_TOPIC)

const client = MQTT.connect("mqtt://localhost")

export const broadcastMessage = async (packet: SignedPacket) => {
    await client.publish(MY_TOPIC, JSON.stringify(packet))
}
export const broadcastSignedMessage = async <T extends Packet>(
    original: T,
    privateKey: KeyInput,
) => await broadcastMessage(signPacket<T>(original, privateKey) as SignedPacket)

// TODO: Implement topicNameMatchesPacketId
// const topicNameMatchesPacketId = (topic: string, packet: SignedPacket) => true

export const hookUpMqttToSubject = async (
    subject: ReplaySubject<SignedPacket>,
) => {
    client.on("message", (_, payload) =>
        subject.next(JSON.parse(payload.toString())),
    )
    await client.subscribe(ALL_TOPICS)
}

const main = async () => {
    const subject = new ReplaySubject<SignedPacket>()
    await hookUpMqttToSubject(subject)
    subject.subscribe(x => console.log({x}))
}

main().catch(console.error)
