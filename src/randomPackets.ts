import {AsyncMqttClient} from "async-mqtt"
import {interval, of} from "rxjs"
import {delay, flatMap} from "rxjs/operators"
import uuid from "uuid"
import {loadKeyPair} from "./crypto"
import {broadcastSignedMessage} from "./mqtt"
import {runAsync} from "./util"

export const randomPacketsMain = async (client: AsyncMqttClient) => {
    const {privateKey, publicKey} = await loadKeyPair()

    interval(10_000)
        .pipe(flatMap(value => of(value).pipe(delay(Math.random() * 2500))))
        .subscribe(() => {
            runAsync(async () => {
                await broadcastSignedMessage(
                    client,
                    {
                        source: {
                            id: uuid(),
                            publicKey,
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
                )
            })
        })
}
