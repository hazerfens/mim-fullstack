import { NextResponse } from 'next/server'
import { subscribeToPermissionEvents } from '@/lib/server-sse'
import { initRedisSseBridge } from '@/lib/redis-sse-bridge'

export const GET = async () => {
  const stream = new ReadableStream({
    start(controller) {
      try {
        void initRedisSseBridge()
      } catch (err) {
        // ignore bridge init failures to keep SSE stream available
        // eslint-disable-next-line no-console
        console.warn('Redis SSE bridge init failed for permissions channel:', err)
      }
      controller.enqueue(new TextEncoder().encode(':ok\n\n'))
      const send = (payload: string) => {
        controller.enqueue(new TextEncoder().encode(`data: ${payload}\n\n`))
      }
      subscribeToPermissionEvents(send)
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
