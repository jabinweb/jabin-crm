import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { ApiErrors, handleApiError } from '@/lib/api-error-handler';
import { prisma } from '@/lib/prisma';
import { slaService } from '@/lib/crm/sla-service';
import { guardTicketAccess } from '@/lib/api/module-guard';
import { isApiException } from '@/lib/api/subscription-guards';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(req);
    await guardTicketAccess(session.user);

    const { id } = await params;

    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
      select: { id: true, customerId: true },
    });

    if (!ticket) {
      throw ApiErrors.notFound('Ticket');
    }

    if (session.user.role === 'CUSTOMER' && session.user.customerId !== ticket.customerId) {
      throw ApiErrors.forbidden();
    }

    const sla = await slaService.getTicketSlaStatus(id);
    if (!sla) {
      throw ApiErrors.notFound('Ticket');
    }

    return NextResponse.json(sla);
  } catch (error) {
    if (!isApiException(error)) {
      console.error('[api/tickets/[id]/sla]', error);
    }
    return handleApiError(error);
  }
}
