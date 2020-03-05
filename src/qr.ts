import {Subject} from "rxjs"
import {scan, startWith, tap} from "rxjs/operators"
import {sensingThreshold} from "./settings"
import {Vector2} from "./types"

export interface Point {
    x: number
    y: number
}

export interface QrCode {
    location: Vector2
    publicKey: Buffer
}
export interface QrCodeInformation extends QrCode {
    sensedAt: number
}

export interface QrCodeRegistry {
    [qrCode: string]: QrCodeInformation | undefined
}

export let registry: QrCodeRegistry = {}

export const qrCodesSubject = new Subject<QrCode>()
export const qrCodes = qrCodesSubject.pipe(
    // tap(({location, publicKey}) =>
    //     console.log(
    //         `Sensed the following code to the ${location}: ${publicKey
    //             .toString("hex")
    //             .slice(0, 4)}`,
    //     ),
    // ),
    scan(
        (acc, curr) => ({
            ...acc,
            [curr.publicKey.toString("hex")]: {...curr, sensedAt: Date.now()},
        }),
        {} as QrCodeRegistry,
    ),
    startWith({} as QrCodeRegistry),
    tap(registry_ => void (registry = registry_)),
)

export const sensedQrCode = (
    registry: QrCodeRegistry,
    code: Buffer,
    timestamp: number,
) => {
    const registryData = registry[code.toString("hex")]
    if (!registryData?.sensedAt) {
        // console.log(
        //     `We have not sensed code ${code
        //         .toString("hex")
        //         .slice(0, 4)} at all!`,
        // )
        return undefined
    } else if (Math.abs(registryData.sensedAt - timestamp) > sensingThreshold) {
        // console.log(
        //     `We have sensed the packet ${(Math.abs(
        //         registryData.sensedAt - timestamp,
        //     ) -
        //         sensingThreshold) /
        //         1000} seconds too late!`,
        // )
        return undefined
    }
    return registryData
}

export const getQrCodeLocation = (registry: QrCodeRegistry, code: Buffer) =>
    registry[code.toString("hex")]?.location
