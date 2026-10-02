import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { ticketService } from '@/lib/crm/ticket-service';
import { ensureFeatureEnabled } from '@/lib/feature-modules';
import { requireTicketRouteAccess } from '@/lib/tenant/ticket-route-guard';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;
    const guard = await requireTicketRouteAccess(session, request, id);
    if (!guard.ok) return guard.response;

    if (guard.session.user.role === 'CUSTOMER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await ensureFeatureEnabled(guard.session.user.id, 'TICKET_ADVANCED');

    const { ticketIds } = await request.json();

    if (!Array.isArray(ticketIds) || ticketIds.length === 0) {
      return NextResponse.json({ error: 'ticketIds array required' }, { status: 400 });
    }

    const primary = await prisma.supportTicket.findUnique({
      where: { id },
      select: { customer: { select: { companyId: true } } },
    });
    const companyId = primary?.customer?.companyId ?? null;
    const sameTenantCount = await prisma.supportTicket.count({
      where: {
        id: { in: ticketIds.map(String) },
        customer: { companyId },
      },
    });
    if (sameTenantCount !== new Set(ticketIds.map(String)).size) {
      return NextResponse.json({ error: 'One or more tickets not found' }, { status: 404 });
    }

    const ticket = await ticketService.mergeTickets(id, ticketIds, guard.session.user.id);
    return NextResponse.json(ticket);
  } catch (error) {
    console.error('[api/tickets/[id]/merge POST]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Merge failed' },
      { status: 500 }
    );
  }
}
