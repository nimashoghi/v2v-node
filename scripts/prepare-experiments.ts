// @ts-ignore
import * as ed from "ed25519-supercop"
import execa from "execa"
import fs from "fs"
import events from "../graph-python/events.json"

const experiment = "triangular"

const x = (name: string) => name.slice(1, name.length - 1).replace(", ", "-")

const main = async () => {
    const privateKeys: Record<string, Buffer> = {}
    const publicKeys: Record<string, Buffer> = {}

    for (const key of Object.keys(events)) {
        const seed = ed.createSeed()
        const {publicKey, secretKey} = ed.createKeyPair(seed)

        publicKeys[key] = publicKey
        privateKeys[key] = secretKey

        const publicKeyPath = `./experiment/${experiment}/${x(key)}/public.bin`
        const privateKeyPath = `./experiment/${experiment}/${x(
            key,
        )}/private.bin`

        execa.commandSync(`mkdir -p ./experiment/${experiment}/${x(key)}/`)

        fs.writeFileSync(publicKeyPath, publicKey)
        fs.writeFileSync(privateKeyPath, secretKey)

        // const qrCodePath = `./experiment/${experiment}/${index}-qr.png`
        // execa.commandSync(
        //     `qrencode -r ${publicKeyPath} -o ${qrCodePath} -d 100 -s 50 -v 2 -l L -8`,
        // )
    }

    for (const key of Object.keys(events)) {
        const base = `./experiment/${experiment}/${x(key)}`
        fs.writeFileSync(
            `./experiment/${experiment}/${x(key)}/.env`,
            `MQTT_HOST=mqtt://localhost
ALL_TOPICS=${Object.keys(events)
                .map(value => x(value))
                .join(",")}
MY_TOPIC=${x(key)}
MY_TIMELINE_LOCATION=${base}/timeline.json
PRIVATE_KEY_LOCATION=${base}/private.bin
PUBLIC_KEY_LOCATION=${base}/public.bin`,
        )
    }

    for (const [key, value] of Object.entries(events)) {
        const sensed = []
        for (const {target, timestamp} of value) {
            sensed.push({
                publicKey: publicKeys[target].toString("hex"),
                timestamp,
            })
        }
        fs.writeFileSync(
            `./experiment/${experiment}/${x(key)}/timeline.json`,
            JSON.stringify(
                sensed.sort((a, b) => a.timestamp - b.timestamp),
                undefined,
                4,
            ),
        )
    }

    const commands = Object.keys(events)
        .map(
            key =>
                `ts-node ./src/index.ts ./experiment/${experiment}/${x(
                    key,
                )}/.env`,
        )
        .map(value => `"${value}"`)
        .join(" ")
    fs.writeFileSync(
        "./commands.sh",
        `#!/bin/bash\nyarn concurrently ${commands}`,
    )
    execa.commandSync("chmod +x ./commands.sh")
}

main().catch(console.error)
