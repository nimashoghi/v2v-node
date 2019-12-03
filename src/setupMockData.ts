// import crypto from "crypto"
// import uuid from "uuid/v4"
// import {signPacket} from "./crypto"
// import {packetsSubject} from "./mqtt"
// import {qrCodesSubject} from "./qr"
// import {packetExpirationDuration, settings} from "./settings"
// import {SignedPacket} from "./types"
// import {sleep} from "./util"

// export const setupMockData = async () => {
//     const other = crypto.generateKeyPairSync(settings.keyType, {
//         modulusLength: settings.keyLength,
//     })
//     const source: SignedPacket["source"] = {
//         id: uuid(),
//         publicKey: other.publicKey
//             .export({format: "pem", type: "pkcs1"})
//             .toString(),
//         timestamp: Date.now(),
//     }
//     const packet = signPacket(
//         {
//             type: "broadcast",
//             event: "fdshofisd",
//             source,
//         },
//         other.privateKey,
//     )
//     packetsSubject.next(packet)
//     await sleep(2000)
//     qrCodesSubject.next({
//         location: "CENTER",
//         publicKey: other.publicKey
//             .export({format: "pem", type: "pkcs1"})
//             .toString(),
//     })
//     await sleep(2000)
//     packetsSubject.next(packet)
//     const rebroadcastPacket = signPacket(
//         {
//             type: "rebroadcast",
//             original: packet,
//             location: "CENTER",
//             source: {
//                 ...source,
//                 timestamp: Date.now() - 2 * packetExpirationDuration,
//             },
//         },
//         other.privateKey,
//     )
//     packetsSubject.next(rebroadcastPacket)
//     await sleep(1000)
//     const rebroadcastRebroadcastPacket = signPacket(
//         {
//             type: "rebroadcast",
//             original: rebroadcastPacket,
//             location: "CENTER",
//             source,
//         },
//         other.privateKey,
//     )
//     packetsSubject.next(rebroadcastRebroadcastPacket)
//     await sleep(1000)
//     packetsSubject.next(rebroadcastPacket)
//     await sleep(1000)
//     while (true) {
//         await sleep(500)
//     }
//     await sleep(10000)
// }
