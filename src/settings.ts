export const settings = {
    algorithm: "RSA-SHA512",
    encoding: "utf8",
    keyLength: 2048,
    keyType: "rsa",
    keyExportFormat: "pem",
    keyExportType: "pkcs1",
} as const

export const mqttHost = process.env.MQTT_HOST

// how long to keep the cache for something that is sensed already
// def: 1 minute
export const sensingThreshold = 1 * 60 * 1000

// number of retries of processing a message
export const maxNumRetries = 4
export const failureRetryDelay = 250

export const confidenceThreshold = 1.0

export const socketServerPort = parseInt(
    process.env.SOCKET_SERVER_PORT ?? "3000",
)

// how long after a packet's timestamp can we trust it for
// def: 5 seconds
export const packetExpirationDuration = 5 * 1000

export const mqttSettings = {
    qos: 2,
} as const
