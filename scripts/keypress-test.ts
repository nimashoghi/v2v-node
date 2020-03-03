// Readline lets us tap into the process events
import {arrowKeyListener} from "../src/keypress"

const main = async () => {
    arrowKeyListener().subscribe(direction => console.log({direction}))
}

main().catch(console.error)
