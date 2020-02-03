export interface MovementEvent {
    command: string
    type: "movement"
}
export type BroadcastEvent = MovementEvent

export interface PacketSource {
    id: string
    publicKey: string
}

export interface Packet {
    event: BroadcastEvent
    source: PacketSource
    timestamp: number
}

export interface SenseEvent {
    id: string
    publicKey: Buffer
    timestamp: number
}
