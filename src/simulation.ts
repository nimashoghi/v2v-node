import {promises as fs} from "fs"
import {of} from "rxjs"
import {delay, flatMap} from "rxjs/operators"
import {assertDefined} from "./util"

const SIMULATION_FILE = assertDefined(process.env.SIMULATION_FILE)

export interface SimulationEvent {
    timestamp: number
    event: any
}

export interface Simulation {
    events: SimulationEvent[]
}

export const getAllSimulations = async () => {
    const start = Date.now()
    const {events}: Simulation = JSON.parse(
        (await fs.readFile(SIMULATION_FILE)).toString(),
    )
    return of(...events).pipe(
        flatMap(({event, timestamp}) =>
            of(event).pipe(delay(new Date(start + timestamp))),
        ),
    )
}
