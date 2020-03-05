import {assertDefined, assert} from "./util"

export const mqttHost = assertDefined(process.env.MQTT_HOST)

// how long to keep the cache for something that is sensed already
// def: 1 minute
export const sensingThreshold = parseFloat(
    assertDefined(process.env.SENSING_THRESHOLD ?? "60000"),
)

export const confidenceThreshold = 1.0

export const socketServerPort = parseInt(
    process.env.SOCKET_SERVER_PORT ?? "3000",
)

// how long after a packet's timestamp can we trust it for
// def: 5 seconds
export const packetExpirationDuration = parseFloat(
    assertDefined(process.env.PACKET_EXPIRATION_DURATION ?? "5000"),
)

export const mqttSettings = {
    qos: (() => {
        const value = parseInt(assertDefined(process.env.MQTT_QOS ?? "1"))
        assert(value === 0 || value === 1 || value === 2)
        return value
    })(),
} as const
