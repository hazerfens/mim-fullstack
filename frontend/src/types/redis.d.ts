/* eslint-disable @typescript-eslint/no-explicit-any */
declare module 'redis' {
  export function createClient(opts?: Record<string, any>): { duplicate(): any; on(event: string, cb: (...args: any[]) => void): void; connect(): Promise<void>; subscribe(channel: string, cb: (message: string) => void): Promise<void>; } & any
}
