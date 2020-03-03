declare module "ed25519-supercop" {
    export interface KeyPair {
        publicKey: Buffer
        secretKey: Buffer
    }

    /**
     * Generate a seed, a 32-byte buffer of cryptographically secure random data.
     */
    export function createSeed(): Buffer

    /**
     * Generate keypair from a 32-byte seed buffer.
     *
     * @param seed The seed returned from `ed.createSeed()`
     *
     * @returns
     *      keypair.publicKey - public key data (32 byte buffer)
     *      keypair.secretKey - secret/private key data (64 byte buffer)
     */
    export function createKeyPair(seed: Buffer): KeyPair

    /**
     * Generate a 64-byte signature given `message`, `publicKey`, and `secretKey`
     *
     * @param message The message to sign
     * @param publicKey The signer's public key
     * @param secretKey The signer's secret key
     */
    export function sign(
        message: string | Buffer,
        publicKey: Buffer,
        secretKey: Buffer,
    ): Buffer

    /**
     * Return a boolean ok, true if the 64-byte buffer or hex string `signature` signs a buffer or string `message` with the 32-byte or hex string `publicKey`.
     *
     * @param signature The signature of the message
     * @param message The message
     * @param publicKey The public key of the signer
     */
    export function verify(
        signature: Buffer,
        message: string | Buffer,
        publicKey: Buffer,
    ): boolean
}
