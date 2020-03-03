import {promises as fs} from "fs"
import path, {parse} from "path"
import {assert} from "../src/util"

const base = "./results"

const main = async () => {
    let totalSent = 0
    const packets: {
        timeout: number
        confidence: number
        confirmations: number
    }[] = []

    const files = await fs.readdir(base)
    for (let i = 0; i < files.length / 2; i++) {
        const csv = files[i * 2]
        const txt = files[i * 2 + 1]

        assert(
            csv.substr(0, csv.lastIndexOf(path.extname(csv))) ===
                txt.substr(0, txt.lastIndexOf(path.extname(txt))),
        )
        const sent = parseInt(
            (await fs.readFile(path.join(base, txt))).toString(),
        )
        totalSent += sent

        const currPackets = (await fs.readFile(path.join(base, csv)))
            .toString()
            .split("\n")
            .filter(line => !!line)
            .map(line => {
                const [
                    ,
                    timeoutStr,
                    timeoutNetStr,
                    confidenceStr,
                    confirmationsStr,
                ] = line.split(",")
                return {
                    timeout: parseFloat(timeoutStr),
                    timeoutNet: parseFloat(timeoutNetStr),
                    timeoutComp:
                        parseFloat(timeoutStr) - parseFloat(timeoutNetStr),
                    confidence: parseFloat(confidenceStr),
                    confirmations: parseFloat(confirmationsStr),
                }
            })
        packets.push(...currPackets)
    }

    await fs.writeFile(
        "./processed.json",
        JSON.stringify(packets, undefined, 4),
    )
    console.log({totalSent})
}

main().catch(console.error)
