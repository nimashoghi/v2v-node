// Readline lets us tap into the process events
import {combineLatest, merge} from "rxjs"
import {debounceTime, filter, map, publish, startWith} from "rxjs/operators"
import {arrowKeyListener} from "../src/keypress"

const main = async () => {
    arrowKeyListener()
        .pipe(
            publish(observable =>
                combineLatest(
                    merge(
                        observable,
                        observable.pipe(
                            debounceTime(500),
                            map(() => "stop" as const),
                        ),
                    ),
                    observable.pipe(
                        filter(key => key === "down" || key === "up"),
                        map(key => key as "down" | "up"),
                        startWith("up" as const),
                    ),
                ),
            ),
        )
        .subscribe(direction => console.log({direction}))
}

main().catch(console.error)
