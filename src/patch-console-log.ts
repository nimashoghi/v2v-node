import {assertDefined} from "./util"

export const patchConsoleLog = () => {
    const logDefault = globalThis.console.log
    globalThis.console.log = (...args: any[]) =>
        logDefault(`[${assertDefined(process.env.MY_TOPIC)}]`, ...args)
}
