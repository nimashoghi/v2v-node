//@ts-ignore
import * as ed from "ed25519-supercop"
import fs from "fs"

const count = 4
const fileName = "./public.bin"
const namedCurve = "curve25519"

const seed = ed.createSeed()
const {publicKey, secretKey} = ed.createKeyPair(seed)
fs.writeFileSync(fileName, publicKey)
// # qrencode -r public.bin -o qr.png -d 100 -s 50 -v 2 -l L -8
// fs.writeFileSync(fileName, zlib.inflateSync(publicKey, {memLevel: 9, level: 9}))

// const {publicKey} = crypto.generateKeyPairSync("ec", {namedCurve})
// // fs.writeFileSync(fileName, publicKey.export({type: "spki", format: "der"}))
// publicKey.export({type: "spki", format: "der"}).byteLength // ?
