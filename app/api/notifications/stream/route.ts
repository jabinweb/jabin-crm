import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { notificationService } from '@/lib/crm/notification-service'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Lightweight SSE stream for staff notification badges.
 * Polls DB every 15s and pushes unread count + latest items.
 */
export async function GET(_req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }

  const userId = session.user.id
  const encoder = new TextEncoder()
  let closed = false

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        if (closed) return
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      send({ type: 'connected' })

      const tick = async () => {
        try {
          const [unread, latest] = await Promise.all([
            notificationService.unreadCount(userId),
            notificationService.getForUser(userId, 5),
          ])
          send({
            type: 'notifications',
            unread,
            latest: latest.map((n) => ({
              id: n.id,
              title: n.title,
              read: n.read,
              createdAt: n.createdAt,
            })),
          })
        } catch (err) {
          send({ type: 'error', message: err instanceof Error ? err.message : 'error' })
        }
      }

      await tick()
      const interval = setInterval(() => {
        if (closed) {
          clearInterval(interval)
          return
        }
        void tick()
      }, 15000)

      const heartbeat = setInterval(() => {
        if (closed) {
          clearInterval(heartbeat)
          return
        }
        send({ type: 'heartbeat', t: Date.now() })
      }, 25000)

      // Close after maxDuration window
      setTimeout(() => {
        closed = true
        clearInterval(interval)
        clearInterval(heartbeat)
        try {
          controller.close()
        } catch {
          /* ignore */
        }
      }, 55000)
    },
    cancel() {
      closed = true
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
