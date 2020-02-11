import {QrCodeRegistry, registry, sensedQrCode} from "./qr"
import {PacketInformation} from "./types"

export function assert(
    condition: unknown,
    message = "Assertion failed!",
): asserts condition {
    if (!condition) {
        throw new Error(message)
    }
}

export const assertDefined = <T>(
    value: T | undefined,
    message = "Assertion failed!",
): T => {
    assert(value !== undefined, message)
    return value
}

export const unreachable = (
    message = "This area of code should be unreachable! Terminating.",
): never => {
    throw new Error(message)
}

export const sleep = (time: number) =>
    new Promise<void>(resolve => setTimeout(resolve, time))

export const runAsync = (
    f: () => Promise<void>,
    onError: (error: any) => void = console.error,
) => f().catch(onError)

export const groupBy = <T, TKey extends string | number | symbol>(
    items: T[],
    keyGetter: (value: T) => TKey,
) =>
    items.reduce((result, item) => {
        const key = keyGetter(item)
        return {
            ...result,
            [key]: [...(result[key] ?? []), item],
        }
    }, {} as {[Key in TKey]: T[]})

export const removeDuplicates = <T, TKey extends string | number | symbol>(
    items: T[],
    keyGetter: (value: T) => TKey,
) =>
    Object.values(
        groupBy<readonly [T, number], TKey>(
            items.map((item, i) => [item, i] as const),
            ([item]) => keyGetter(item),
        ),
    )
        .map(inputArray => (inputArray as (readonly [T, number])[])[0])
        .sort((a, b) => a[1] - b[1])
        .map(([value]) => value)
