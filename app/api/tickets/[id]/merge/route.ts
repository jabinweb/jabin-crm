import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ticketService } from '@/lib/crm/ticket-service';
import { ensureFeatureEnabled } from '@/lib/feature-modules';
import { handleApiError } from '@/lib/api-error-handler';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await ensureFeatureEnabled(session.user.id, 'TICKET_ADVANCED');

    const { id } = await params;
    const { ticketIds } = await request.json();

    if (!Array.isArray(ticketIds) || ticketIds.length === 0) {
      return NextResponse.json({ error: 'ticketIds array required' }, { status: 400 });
    }

    const ticket = await ticketService.mergeTickets(id, ticketIds, session.user.id);
    return NextResponse.json(ticket);
  } catch (error) {
    console.error('[api/tickets/[id]/merge POST]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Merge failed' },
      { status: 500 }
    );
  }
}
