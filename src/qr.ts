import {Subject} from "rxjs"
import {scan, startWith, tap} from "rxjs/operators"
import {normalizeCode} from "./crypto"
import {sensingThreshold} from "./settings"
import {QrCode} from "./socketio"

export interface QrCodeInformation extends QrCode {
    sensedAt: number
}

export interface QrCodeRegistry {
    [qrCode: string]: QrCodeInformation | undefined
}

export let registry: QrCodeRegistry = {}

export const qrCodesSubject = new Subject<QrCode>()
export const qrCodes = qrCodesSubject.pipe(
    tap(({location, publicKey}) =>
        console.log(
            `Sensed the following code to the ${location}: ${publicKey.slice(
                0,
                25,
            )}...`,
        ),
    ),
    scan(
        (acc, curr) => ({
            ...acc,
            [curr.publicKey]: {...curr, sensedAt: Date.now()},
        }),
        {} as QrCodeRegistry,
    ),
    startWith({} as QrCodeRegistry),
    tap(registry_ => void (registry = registry_)),
)

export const sensedQrCode = (
    registry: QrCodeRegistry,
    code_: string,
    timestamp: number,
) => {
    const code = normalizeCode(code_)
    const sensedAt = registry[code]?.sensedAt
    if (!sensedAt) {
        console.log(`We have not sensed code ${code} at all!`)
        return false
    } else if (Math.abs(sensedAt - timestamp) > sensingThreshold) {
        console.log(
            `We have sensed the packet ${(Math.abs(sensedAt - timestamp) -
                sensingThreshold) /
                1000} seconds too late!`,
        )
        return false
    }
    return true
}

export const getQrCodeLocation = (registry: QrCodeRegistry, code: string) =>
    registry[normalizeCode(code)]?.location
