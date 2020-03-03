export interface MovementEvent {
    type: "movement"
    command: string
}
export type BroadcastEvent = MovementEvent

export type ObjectLocation = "LEFT" | "CENTER" | "RIGHT"

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
    location: ObjectLocation
    original: SignedPacket
}

export type Packet = BroadcastPacket | RebroadcastPacket
export type SignedPacket = Signed<BroadcastPacket> | Signed<RebroadcastPacket>

export interface PacketInformation {
    depth: number
    original: Signed<BroadcastPacket>
    packet: SignedPacket
}
