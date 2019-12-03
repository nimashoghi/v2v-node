import SerialPort from "serialport"

const connection = new SerialPort(
    process.env.ROBOT_SERIAL ?? "/dev/ttyUSB0",
    {
        baudRate: parseInt(process.env.ROBOT_BAUD ?? "115200"),
    },
    async error => {
        if (error) {
            console.error(
                `Got the following error when intializing SerialPort: ${error}`,
            )
            return
        }

        await executeCommand([128])
        await executeCommand([0x84]) // FULL mode
        await executeCommand([140, 3, 1, 64, 16, 141, 3]) // beep

        // await executeCommand([145, 1, 94, 0, 50])
        // setTimeout(async () => {
        //     await executeCommand([145, 0, 0, 0, 0])
        // }, 5000)
    },
)

export const executeCommand = async (command: string | Buffer | number[]) => {
    const buffer =
        typeof command === "string" ? Buffer.from(command, "base64") : command
    console.log(`executing command ${buffer}`)

    await new Promise<number>((resolve, reject) =>
        connection.write(buffer, (error, bytesWritten) => {
            if (error) {
                reject(error)
            } else {
                resolve(bytesWritten)
            }
        }),
    )
}
