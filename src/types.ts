export type Vector2 = readonly [number, number]

export interface CommandEvent {
    command: string
    direction: "up" | "down" | "right" | "left" | "stop" | "space"
    type: "command"
}
export interface StopEvent {
    type: "stop"
}
export type BroadcastEvent = CommandEvent | StopEvent

export interface PacketSource {
    id: string
    timestamp: number
    publicKey: string
}

export interface PacketBase {
    source: PacketSource
}

export type Unsigned<T extends PacketBase & {signature: string}> = Omit<
    T,
    "signature"
>
export type Signed<T extends PacketBase> = T & {signature: string}

export interface BroadcastPacket extends PacketBase {
    type: "broadcast"
    event: BroadcastEvent
}

export interface RebroadcastPacket extends PacketBase {
    type: "rebroadcast"
    location: Vector2
    original: SignedPacket
}

export type Packet = BroadcastPacket | RebroadcastPacket
export type SignedPacket = Signed<BroadcastPacket> | Signed<RebroadcastPacket>

export interface PacketInformation {
    depth: number
    original: Signed<BroadcastPacket>
    packet: SignedPacket
}

export type Processed<T extends PacketBase> = Signed<T> & {
    location: readonly [number, number]
}
