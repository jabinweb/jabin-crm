import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/api-error-handler';
import { guardTicketAccess } from '@/lib/api/module-guard';
import { isApiException } from '@/lib/api/subscription-guards';
import { requireTicketRouteAccess } from '@/lib/tenant/ticket-route-guard';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    await guardTicketAccess(session?.user);

    const { id } = await params;
    const guard = await requireTicketRouteAccess(session, request, id);
    if (!guard.ok) return guard.response;

    const { rating, comment } = await request.json();

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 });
    }

    const updated = await prisma.supportTicket.update({
      where: { id },
      data: {
        csatRating: rating,
        csatComment: comment ?? null,
        csatSubmittedAt: new Date(),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (!isApiException(error)) {
      console.error('[api/tickets/[id]/csat]', error);
    }
    return handleApiError(error);
  }
}
