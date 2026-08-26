import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withTenantRoute, jsonOk } from '@/lib/api/with-route'
import { hasLegacyRole } from '@/lib/auth/permissions'
import { ticketService } from '@/lib/crm/ticket-service'
import { TicketPriority, TicketStatus } from '@prisma/client'

export const POST = withTenantRoute(async (request, { session, companyId }) => {
  if (!hasLegacyRole(session, 'ADMIN', 'SUPPORT_MANAGER', 'SUPER_ADMIN', 'TECHNICIAN', 'SALES')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const body = await request.json()
  const ids: string[] = Array.isArray(body.ticketIds) ? body.ticketIds : []
  if (!ids.length) return NextResponse.json({ error: 'ticketIds required' }, { status: 400 })

  const tickets = await prisma.supportTicket.findMany({
    where: { id: { in: ids }, customer: { companyId: companyId! } },
    select: { id: true },
  })
  const validIds = tickets.map((t) => t.id)
  if (!validIds.length) return NextResponse.json({ error: 'No tickets found' }, { status: 404 })

  const action = body.action as string
  let updated = 0

  if (action === 'set_status' && body.status) {
    for (const id of validIds) {
      await ticketService.updateStatus(id, body.status as TicketStatus, session.user.id)
      updated++
    }
  } else if (action === 'set_priority' && body.priority) {
    const priority = body.priority as TicketPriority
    await prisma.supportTicket.updateMany({
      where: { id: { in: validIds } },
      data: { priority },
    })
    for (const id of validIds) {
      await ticketService.logActivity(
        id,
        'PRIORITY_CHANGED',
        `Bulk priority → ${priority}`,
        session.user.id,
        undefined,
        true
      )
    }
    updated = validIds.length
  } else if (action === 'assign' && body.assignedTechnicianId) {
    await prisma.supportTicket.updateMany({
      where: { id: { in: validIds } },
      data: { assignedTechnicianId: body.assignedTechnicianId, status: TicketStatus.ASSIGNED },
    })
    updated = validIds.length
  } else if (action === 'add_tag' && typeof body.tag === 'string') {
    const tag = body.tag.trim()
    const existing = await prisma.supportTicket.findMany({
      where: { id: { in: validIds } },
      select: { id: true, tags: true },
    })
    await prisma.$transaction(
      existing.map((ticket) =>
        prisma.supportTicket.update({
          where: { id: ticket.id },
          data: { tags: Array.from(new Set([...ticket.tags, tag])) },
        })
      )
    )
    updated = existing.length
  } else if (action === 'remove_tag' && typeof body.tag === 'string') {
    const existing = await prisma.supportTicket.findMany({
      where: { id: { in: validIds } },
      select: { id: true, tags: true },
    })
    await prisma.$transaction(
      existing.map((ticket) =>
        prisma.supportTicket.update({
          where: { id: ticket.id },
          data: { tags: ticket.tags.filter((tag) => tag !== body.tag) },
        })
      )
    )
    updated = existing.length
  } else {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }

  return jsonOk({ updated, ids: validIds })
})
