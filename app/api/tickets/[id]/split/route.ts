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
    const { subject, description } = await request.json();

    if (!subject?.trim() || !description?.trim()) {
      return NextResponse.json({ error: 'Subject and description required' }, { status: 400 });
    }

    const newTicket = await ticketService.splitTicket(
      id,
      { subject: subject.trim(), description: description.trim() },
      session.user.id
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
