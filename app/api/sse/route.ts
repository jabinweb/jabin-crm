import { NextRequest } from 'next/server'
import { auth } from '@/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

type StreamWriter = WritableStreamDefaultWriter<Uint8Array>

/** Per-isolate connection registry (not shared across Vercel instances). */
const connections = new Map<string, StreamWriter>()
const encoder = new TextEncoder()
const HEARTBEAT_MS = 15_000

function connectionId(user: { employeeId?: string | null; id?: string | null }): string | null {
  return user.employeeId || user.id || null
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    const user = session?.user as { employeeId?: string | null; id?: string | null } | undefined
    const userId = user ? connectionId(user) : null

    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const stream = new TransformStream<Uint8Array, Uint8Array>()
    const writer = stream.writable.getWriter()
    const previous = connections.get(userId)
    if (previous) {
      try {
        await previous.close()
      } catch {
        /* ignore */
      }
    }
    connections.set(userId, writer)

    let closed = false
    const close = () => {
      if (closed) return
      closed = true
      clearInterval(heartbeat)
      if (connections.get(userId) === writer) {
        connections.delete(userId)
      }
      writer.close().catch(() => undefined)
    }

    const heartbeat = setInterval(() => {
      writer
        .write(encoder.encode(`data: ${JSON.stringify({ type: 'heartbeat' })}\n\n`))
        .catch(() => close())
    }, HEARTBEAT_MS)

    req.signal.addEventListener('abort', close)

    try {
      await writer.write(
        encoder.encode(`data: ${JSON.stringify({ type: 'connected', userId })}\n\n`)
      )
    } catch {
      close()
      return new Response('Unable to open stream', { status: 503 })
    }

    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (error) {
    console.error('[SSE] Error:', error)
    return new Response(JSON.stringify({ error: 'Service Unavailable' }), {
      status: 503,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': '10',
      },
    })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const user = session?.user as { employeeId?: string | null; id?: string | null } | undefined
    const senderId = user ? connectionId(user) : null

    if (!senderId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const receiverId = typeof body.receiverId === 'string' ? body.receiverId : ''
    if (!receiverId) {
      return new Response(JSON.stringify({ error: 'receiverId is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const writer = connections.get(receiverId)
    const payload = {
      type: body.type ?? 'webrtc_signaling',
      payload: body.payload,
      senderId,
    }

    let delivered = false
    if (writer) {
      try {
        await writer.write(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
        delivered = true
      } catch {
        connections.delete(receiverId)
      }
    }

    return new Response(JSON.stringify({ ok: true, delivered }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[SSE] POST error:', error)
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
