/* eslint-disable @typescript-eslint/no-explicit-any */
import { broadcastPermissionEvent, broadcastRoleEvent, broadcastUserEvent } from './server-sse'

let started = false
let client: any = null

export async function initRedisSseBridge() {
  if (started) return
  started = true
  try {
    // Dynamic import to avoid hard dependency during static analysis when
    // the redis package is not installed in local dev. We still attempt to
    // connect at runtime if available.
    const redisMod: any = await import('redis').catch(() => null)
    if (!redisMod || !redisMod.createClient) {
      console.warn('redis-sse-bridge: redis client not available; skipping bridge')
      return
    }
    const { createClient } = redisMod
    const url = process.env.REDIS_URL || process.env.NEXT_PUBLIC_REDIS_URL
    client = createClient(url ? { url } : undefined)
    client.on('error', (err: any) => {
      console.error('redis client error', err)
    })
    await client.connect()
    const sub = client.duplicate()
    sub.on('error', (err: any) => {
      console.error('redis subscriber error', err)
    })
    await sub.connect()
    // subscribe to permissions channel
    await sub.subscribe('permissions', (message: string) => {
      try {
        const payload = JSON.parse(message)
        // Route events to appropriate in-memory broadcasters
        const t = payload && payload.type ? String(payload.type) : ''
        if (t.startsWith('user.')) {
          broadcastUserEvent(payload)
        }
        if (t.startsWith('role.')) {
          broadcastRoleEvent(payload)
        }
        // permission.* or role.permissions.* etc
        broadcastPermissionEvent(payload)
      } catch (err: any) {
        console.error('redis-sse-bridge: failed to parse message', err)
      }
    })
    console.info('redis-sse-bridge: subscribed to permissions channel')
  } catch (err: any) {
    console.error('redis-sse-bridge: initialization failed', err)
    started = false
  }
}
