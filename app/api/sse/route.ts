import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const preferredRegion = 'auto'
export const maxDuration = 60 // 1 minutes

const connections = new Map<string, WritableStreamDefaultWriter<Uint8Array>>()
const encoder = new TextEncoder()
const HEARTBEAT_INTERVAL = 30000 // 30 seconds

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    const user = session?.user as any  // Cast to bypass type issues
    
    if (!user?.employeeId) {
      return new Response('Unauthorized', { status: 401 })
    }

    const userId = user.employeeId
    const stream = new TransformStream()
    const writer = stream.writable.getWriter()
    connections.set(userId, writer)

    // Send initial connection message
    await writer.write(
      encoder.encode(`data: ${JSON.stringify({ type: 'connected' })}\n\n`)
    )

    let isConnected = true
    const heartbeat = setInterval(async () => {
      if (!isConnected) {
        clearInterval(heartbeat)
        return
      }
      try {
        await writer.write(
          encoder.encode(`data: ${JSON.stringify({ type: 'heartbeat' })}\n\n`)
        )
      } catch {
        isConnected = false
        clearInterval(heartbeat)
      }
    }, HEARTBEAT_INTERVAL)

    // Cleanup on disconnect
    req.signal.addEventListener('abort', () => {
      isConnected = false
      clearInterval(heartbeat)
      connections.delete(userId)
      writer.close().catch(() => undefined)
    })

    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    console.error('[SSE] Error:', error)
    return new Response('Error', { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const user = session?.user as { employeeId?: string; id?: string } | undefined

    if (!user?.employeeId && !user?.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const receiverId = body.receiverId as string | undefined

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
      senderId: user.employeeId ?? user.id,
    }

    if (writer) {
      await writer.write(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
    }

    return new Response(JSON.stringify({ ok: true, delivered: !!writer }), {
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

// Helper to broadcast messages to connected clients
export async function broadcast(message: any, excludeSessionId?: string) {
  const encoder = new TextEncoder()
  const encoded = encoder.encode(`data: ${JSON.stringify(message)}\n\n`)

  // Use Array.from to convert Map entries to array for iteration
  await Promise.all(
    Array.from(connections).map(async ([sessionId, writer]) => {
      if (sessionId !== excludeSessionId) {
        try {
          await writer.write(encoded)
        } catch (error) {
          connections.delete(sessionId)
        }
      }
    })
  )
}

// Clean up on module reload
globalThis.addEventListener?.('beforeunload', () => {
  // Use Array.from for values iteration
  Array.from(connections.values()).forEach(writer => {
    writer.close()
  })
  connections.clear()
})




