import { NextResponse } from 'next/server'
import { subscribeToRoleEvents } from '@/lib/server-sse'
import { initRedisSseBridge } from '@/lib/redis-sse-bridge'

export const GET = async () => {
  const stream = new ReadableStream({
    start(controller) {
      try {
        void initRedisSseBridge()
      } catch (err) {
        // If Redis bridge initialization fails, log and continue with in-memory SSE only
        // so clients still get a working endpoint instead of an abrupt connection error.
        // Note: actual logging on the server is limited here; console is available during dev.
        // eslint-disable-next-line no-console
        console.warn('Redis SSE bridge initialization failed:', err)
      }
      controller.enqueue(new TextEncoder().encode(':ok\n\n'))
      const send = (payload: string) => {
        controller.enqueue(new TextEncoder().encode(`data: ${payload}\n\n`))
      }
      subscribeToRoleEvents(send)
    }
  })

  return new NextResponse(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  })
}
