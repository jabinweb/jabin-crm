import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { ApiErrors, handleApiError } from '@/lib/api-error-handler';
import { prisma } from '@/lib/prisma';
import { slaService } from '@/lib/crm/sla-service';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(req);
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
    return handleApiError(error);
  }
}
