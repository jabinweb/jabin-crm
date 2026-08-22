import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withTenantRoute, jsonOk } from '@/lib/api/with-route'
import { ticketService } from '@/lib/crm/ticket-service'

export const GET = withTenantRoute(async (request, { session }, routeContext) => {
  const ticketId = (await routeContext.params).id
  const ticket = await prisma.supportTicket.findFirst({
    where: { id: ticketId },
    include: { customer: { select: { companyId: true } } },
  })
  if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const watchers = await prisma.ticketWatcher.findMany({
    where: { ticketId },
    include: { user: { select: { id: true, name: true, email: true } } },
  })
  const watching = watchers.some((w) => w.userId === session.user.id)
  return jsonOk({ watching, watchers })
})

export const POST = withTenantRoute(async (_request, { session }, routeContext) => {
  const ticketId = (await routeContext.params).id
  const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } })
  if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.ticketWatcher.upsert({
    where: { ticketId_userId: { ticketId, userId: session.user.id } },
    create: { ticketId, userId: session.user.id },
    update: {},
  })
  await ticketService.logActivity(
    ticketId,
    'WATCH',
    `${session.user.name || 'Agent'} started watching`,
    session.user.id
  )
  return jsonOk({ watching: true })
})

export const DELETE = withTenantRoute(async (_request, { session }, routeContext) => {
  const ticketId = (await routeContext.params).id
  await prisma.ticketWatcher.deleteMany({
    where: { ticketId, userId: session.user.id },
  })
  return jsonOk({ watching: false })
})
