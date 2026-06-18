import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ApiErrors, handleApiError } from '@/lib/api-error-handler';
import { slaService } from '@/lib/crm/sla-service';
import { guardTicketAccess } from '@/lib/api/module-guard';
import { isApiException } from '@/lib/api/subscription-guards';
import { requireTicketRouteAccess } from '@/lib/tenant/ticket-route-guard';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    await guardTicketAccess(session?.user);

    const { id } = await params;
    const guard = await requireTicketRouteAccess(session, req, id);
    if (!guard.ok) return guard.response;

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
