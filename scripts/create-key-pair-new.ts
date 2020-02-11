//@ts-ignore
import * as ed from "ed25519-supercop"
import execa from "execa"
import fs from "fs"

const count = 4

for (let index = 0; index <= count; index++) {
    const seed = ed.createSeed()
    const {publicKey, secretKey} = ed.createKeyPair(seed)

    const publicKeyPath = `./keys/${index}-public.bin`
    const privateKeyPath = `./keys/${index}-private.bin`
    const qrCodePath = `./keys/${index}-qr.png`

    fs.writeFileSync(publicKeyPath, publicKey)
    fs.writeFileSync(privateKeyPath, secretKey)

    execa.commandSync(
        `qrencode -r ${publicKeyPath} -o ${qrCodePath} -d 100 -s 50 -v 2 -l L -8`,
    )
}
