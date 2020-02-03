import MQTT from "async-mqtt"
import {Subject} from "rxjs"
import {SenseEvent} from "./types"

export const packets = new Subject<[string, Buffer, MQTT.Packet]>()
export const sensed = new Subject<SenseEvent>()
