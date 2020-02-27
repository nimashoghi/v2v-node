declare module "svmq" {
    export interface Options {
        flags?: number
        type?: number
    }

    export interface Queue {
        close(f?: (err: Error | undefined, closed: boolean) => void): boolean
        on(event: "data", f: (data: Buffer) => void): void
        pop(f: (err: Error | undefined, data: Buffer) => void): void
        pop(
            options: Options,
            f: (err: Error | undefined, data: Buffer) => void,
        ): void
        push(data: Buffer, f?: (err: Error | undefined) => void): void
        push(
            data: Buffer,
            options: Options,
            f?: (err: Error | undefined) => void,
        ): void
    }

    const MessageQueue: {
        open: (key: number) => Queue
    }
    export default MessageQueue
}
