import { NextResponse } from 'next/server'
import { subscribeToRoleEvents } from '@/lib/server-sse'

export const GET = async () => {
  const stream = new ReadableStream({
    start(controller) {
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
