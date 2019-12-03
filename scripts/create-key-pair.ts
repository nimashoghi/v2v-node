import crypto, {KeyObject} from "crypto"
import fs from "fs"
import {settings} from "../src/settings"

for (let i = 0; i <= 4; ++i) {
    const {privateKey, publicKey} = crypto.generateKeyPairSync(
        settings.keyType,
        {
            modulusLength: settings.keyLength,
        },
    )

    exportKey(privateKey, `./private-${i}.pem`)
    exportKey(publicKey, `./public-${i}.pem`)

    function exportKey(key: KeyObject, path: string) {
        fs.writeFileSync(
            path,
            key.export({
                format: settings.keyExportFormat,
                type: settings.keyExportType,
            }),
        )
    }
}
