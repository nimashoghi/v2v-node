import {assertDefined} from "./util"

export const MAX_TRIALS = () => parseInt(assertDefined(process.env.MAX_TRIALS))
export const MAX_ALLOWED_TIMESTAMP = () =>
    parseInt(assertDefined(process.env.MAX_ALLOWED_TIMESTAMP))
