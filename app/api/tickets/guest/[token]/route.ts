import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveTicketByGuestToken } from '@/lib/crm/ticket-guest-access'
import { ticketService } from '@/lib/crm/ticket-service'

type RouteContext = { params: Promise<{ token: string }> }

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { token } = await context.params
    const ticket = await resolveTicketByGuestToken(token)
    if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({
      id: ticket.id,
      subject: ticket.subject,
      description: ticket.description,
      status: ticket.status,
      priority: ticket.priority,
      createdAt: ticket.createdAt,
      customer: ticket.customer,
      activities: ticket.activities,
      attachments: ticket.attachments,
      csatRating: ticket.csatRating,
      csatComment: ticket.csatComment,
    })
  } catch (e) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { token } = await context.params
    const ticket = await resolveTicketByGuestToken(token)
    if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const body = await request.json()

    if (body.action === 'reply') {
      const message = typeof body.message === 'string' ? body.message.trim() : ''
      if (!message) return NextResponse.json({ error: 'message required' }, { status: 400 })
      await ticketService.addComment(ticket.id, message, undefined, { isInternal: false })
      return NextResponse.json({ ok: true })
    }

    if (body.action === 'csat') {
      const rating = Number(body.rating)
      if (!rating || rating < 1 || rating > 5) {
        return NextResponse.json({ error: 'rating 1-5 required' }, { status: 400 })
      }
      await ticketService.submitCsat(ticket.id, rating, body.comment || '')
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e) {
    console.error('[guest ticket]', e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
