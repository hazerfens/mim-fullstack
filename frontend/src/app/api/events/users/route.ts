import { NextResponse } from 'next/server'
import { subscribeToUserEvents } from '@/lib/server-sse'

export const GET = async () => {
  const stream = new ReadableStream({
    start(controller) {
      // write initial comment to establish SSE
      controller.enqueue(new TextEncoder().encode(':ok\n\n'))
      const send = (payload: string) => {
        controller.enqueue(new TextEncoder().encode(`data: ${payload}\n\n`))
      }
      // subscribe; unsubscribe is intentionally not stored here. In typical Next deployments
      // the process lifecycle means the subscription will be reclaimed when the server restarts.
      subscribeToUserEvents(send)
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
