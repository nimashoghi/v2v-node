import {promises as fs} from "fs"
import {from, of} from "rxjs"
import {delay, flatMap} from "rxjs/operators"
import {qrCodesSubject} from "./qr"
import {assertDefined} from "./util"

const MY_TIMELINE_LOCATION = () =>
    assertDefined(process.env.MY_TIMELINE_LOCATION)

export const timelineMain = async () => {
    const data: {publicKey: string; timestamp: number}[] = JSON.parse(
        (await fs.readFile(MY_TIMELINE_LOCATION())).toString(),
    )
    const observable = from(
        data.map(value => ({
            ...value,
            publicKey: Buffer.from(value.publicKey, "hex"),
        })),
    ).pipe(flatMap(value => of(value).pipe(delay(value.timestamp * 1000))))
    observable.subscribe(({publicKey}) => {
        qrCodesSubject.next({location: "CENTER", publicKey})
    })
}
