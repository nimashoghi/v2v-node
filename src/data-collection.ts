import {existsSync, promises as fs} from "fs"
import {assertDefined} from "./util"

export const networkDelay = new Map<string, number>()

export const initDuration = async () => {
    const f = `./results/${assertDefined(process.env.MY_TOPIC)}.csv`
    if (!existsSync(f)) {
        return
    }
    await fs.unlink(f)
}

export const writeDuration = async (
    id: string,
    procIds: string[],
    duration: number,
    confidence: number,
    confirmations: number,
) =>
    await fs.appendFile(
        `./results/${assertDefined(process.env.MY_TOPIC)}.csv`,
        `${id},${duration},${procIds
            .map(id => networkDelay.get(id) ?? 0)
            .reduce(
                (acc, curr) => acc + curr,
                0,
            )},${confidence},${confirmations}\n`,
    )

let count = 0
export const writeCount = async () =>
    await fs.writeFile(
        `./results/${assertDefined(process.env.MY_TOPIC)}.txt`,
        `${++count}\n`,
    )
