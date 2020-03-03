import readline from "readline"
import {Observable} from "rxjs"

export type Key = "up" | "down" | "right" | "left" | "space"
const keys = {
    [Buffer.from([0x1b, 0x5b, 0x41]).toString()]: "up",
    [Buffer.from([0x1b, 0x5b, 0x42]).toString()]: "down",
    [Buffer.from([0x1b, 0x5b, 0x43]).toString()]: "right",
    [Buffer.from([0x1b, 0x5b, 0x44]).toString()]: "left",
    [Buffer.from([0x20]).toString()]: "space",
} as const

export const arrowKeyListener = () =>
    new Observable<Key>(observer => {
        // Allows us to listen for events from stdin
        readline.emitKeypressEvents(process.stdin)

        // Raw mode gets rid of standard keypress events and other
        // functionality Node.js adds by default
        process.stdin.setRawMode(true)

        // Start the keypress listener for the process
        process.stdin.on("keypress", (_, input) => {
            // "Raw" mode so we must do our own kill switch
            if (input.sequence === "\u0003") {
                process.exit()
            }

            const key = keys[input.sequence]
            if (key) {
                observer.next(key)
            }
        })
    })
