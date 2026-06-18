import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
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

    await ensureFeatureEnabled(guard.session.user.id, 'TICKET_ADVANCED');

    const { subject, description } = await request.json();

    if (!subject?.trim() || !description?.trim()) {
      return NextResponse.json({ error: 'Subject and description required' }, { status: 400 });
    }

    const newTicket = await ticketService.splitTicket(
      id,
      { subject: subject.trim(), description: description.trim() },
      guard.session.user.id
    );

    return NextResponse.json(newTicket, { status: 201 });
  } catch (error) {
    console.error('[api/tickets/[id]/split POST]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Split failed' },
      { status: 500 }
    );
  }
}
