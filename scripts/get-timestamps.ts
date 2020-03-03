import {promises as fs} from "fs"

const main = async () => {
    const timestamps = (await fs.readFile("/dev/stdin"))
        .toString()
        .split("\n")
        .map(value => value.trim())
        .filter(line => !!line)
        .map(line => parseInt(line.match(/TIMESTAMP: (\d+)/)?.[1] ?? "0"))
    console.log(timestamps.reduce((a, b) => a + b) / timestamps.length)
}

main().catch(console.error)
