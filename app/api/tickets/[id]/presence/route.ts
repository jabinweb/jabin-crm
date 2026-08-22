import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withTenantRoute, jsonOk } from '@/lib/api/with-route'
import {
  ensureTicketGuestToken,
  revokeTicketGuestToken,
  rotateTicketGuestToken,
} from '@/lib/crm/ticket-guest-access'
import { publishRealtime } from '@/lib/realtime/hub'
import { REALTIME_EVENTS } from '@/lib/realtime/events'

/** Presence heartbeat + guest link mint/revoke for a ticket. */
export const GET = withTenantRoute(async (_request, { session, companyId }, routeContext) => {
  const ticketId = (await routeContext.params).id
  const ticket = await prisma.supportTicket.findFirst({
    where: { id: ticketId, customer: { companyId: companyId! } },
    select: { id: true, guestAccessToken: true },
  })
  if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const recent = await prisma.ticketActivity.findMany({
    where: {
      ticketId,
      eventType: 'PRESENCE',
      createdAt: { gte: new Date(Date.now() - 60_000) },
    },
    include: { performedBy: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })
  const viewers = Array.from(
    new Map(
      recent
        .filter((a) => a.performedById)
        .map((a) => [a.performedById!, { id: a.performedById!, name: a.performedBy?.name || 'Agent' }])
    ).values()
  )

  return jsonOk({
    viewers,
    guestAccessToken: ticket.guestAccessToken,
    hasGuestLink: Boolean(ticket.guestAccessToken),
    me: session.user.id,
  })
})

export const POST = withTenantRoute(async (request, { session, companyId }, routeContext) => {
  const ticketId = (await routeContext.params).id
  const ticket = await prisma.supportTicket.findFirst({
    where: { id: ticketId, customer: { companyId: companyId! } },
  })
  if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const body = await request.json().catch(() => ({}))

  if (body.action === 'heartbeat') {
    const since = new Date(Date.now() - 45_000)
    const existing = await prisma.ticketActivity.findFirst({
      where: {
        ticketId,
        eventType: 'PRESENCE',
        performedById: session.user.id,
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'desc' },
    })
    if (existing) {
      await prisma.ticketActivity.update({
        where: { id: existing.id },
        data: {
          description: body.typing ? 'typing' : 'viewing',
          metadata: { typing: Boolean(body.typing) },
        },
      })
    } else {
      await prisma.ticketActivity.create({
        data: {
          ticketId,
          eventType: 'PRESENCE',
          description: body.typing ? 'typing' : 'viewing',
          isInternal: true,
          performedById: session.user.id,
          metadata: { typing: Boolean(body.typing) },
        },
      })
    }
    // Prune stale presence rows so Activity history stays clean
    await prisma.ticketActivity.deleteMany({
      where: {
        ticketId,
        eventType: 'PRESENCE',
        createdAt: { lt: new Date(Date.now() - 5 * 60_000) },
      },
    })

    const isTyping = Boolean(body.typing)
    void publishRealtime(
      isTyping ? REALTIME_EVENTS.TICKET_TYPING : REALTIME_EVENTS.TICKET_PRESENCE,
      companyId!,
      {
        ticketId,
        userId: session.user.id,
        userName: session.user.name ?? 'Agent',
        typing: isTyping,
      },
      session.user.id
    )

    return jsonOk({ ok: true })
  }

  if (body.action === 'guest_link') {
    const token = await ensureTicketGuestToken(ticketId)
    return jsonOk({ token, path: `/ticket/${token}`, hasGuestLink: true })
  }

  if (body.action === 'revoke_guest_link') {
    await revokeTicketGuestToken(ticketId)
    return jsonOk({ hasGuestLink: false })
  }

  if (body.action === 'rotate_guest_link') {
    const token = await rotateTicketGuestToken(ticketId)
    return jsonOk({ token, path: `/ticket/${token}`, hasGuestLink: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
})
