// Simple in-memory server-side event broadcaster for Next server
// This module is intended to be imported only by server-side code
type SendFn = (payload: string) => void

const subscribers = new Set<SendFn>()
const roleSubscribers = new Set<SendFn>()
const permissionSubscribers = new Set<SendFn>()

export function subscribeToUserEvents(send: SendFn) {
  subscribers.add(send)
  return () => subscribers.delete(send)
}

export function broadcastUserEvent(event: unknown) {
  try {
    const payload = JSON.stringify(event)
    for (const send of Array.from(subscribers)) {
      try {
        send(payload)
      } catch {
        // ignore per-client errors
      }
    }
  } catch {
    // ignore
  }
}

export function subscribeToRoleEvents(send: SendFn) {
  roleSubscribers.add(send)
  return () => roleSubscribers.delete(send)
}

export function broadcastRoleEvent(event: unknown) {
  try {
    const payload = JSON.stringify(event)
    for (const send of Array.from(roleSubscribers)) {
      try {
        send(payload)
      } catch {
        // ignore per-client errors for role channel
      }
    }
  } catch {
    // ignore
  }
}

export function subscribeToPermissionEvents(send: SendFn) {
  permissionSubscribers.add(send)
  return () => permissionSubscribers.delete(send)
}

export function broadcastPermissionEvent(event: unknown) {
  try {
    const payload = JSON.stringify(event)
    for (const send of Array.from(permissionSubscribers)) {
      try {
        send(payload)
      } catch {
        // ignore per-client errors for permission channel
      }
    }
  } catch {
    // ignore
  }
}
