import {AsyncMqttClient} from "async-mqtt"
import {interval, Observable, of} from "rxjs"
import {delay, flatMap, takeUntil} from "rxjs/operators"
import uuid from "uuid"
import {loadKeyPair} from "./crypto"
import {writeCount} from "./data-collection"
import {broadcastSignedMessage} from "./mqtt"
import {runAsync} from "./util"

const [intervalDelay, randomDelay] =
    process.env.LOAD === "high" ? [1_000, 250] : [10_000, 2_500]

export const randomPacketsMain = async (
    client: AsyncMqttClient,
    stopSignal: Observable<void>,
) => {
    const {privateKey, publicKey} = await loadKeyPair()

    return interval(intervalDelay)
        .pipe(
            flatMap(value =>
                of(value).pipe(delay(Math.random() * randomDelay)),
            ),
            takeUntil(stopSignal),
        )
        .subscribe(() => {
            runAsync(async () => {
                const id = uuid()
                console.log(`Sent packet ${id}`)
                await Promise.all([
                    broadcastSignedMessage(
                        client,
                        {
                            source: {
                                id,
                                publicKey: publicKey.toString("hex"),
                                timestamp: Date.now(),
                            },
                            type: "broadcast",
                            event: {
                                type: "movement",
                                command: `${Math.random()}`,
                            },
                        },
                        publicKey,
                        privateKey,
                    ),
                    writeCount(),
                ])
            })
        })
}
