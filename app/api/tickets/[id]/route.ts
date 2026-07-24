import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ticketService } from '@/lib/crm/ticket-service';
import { handleApiError } from '@/lib/api-error-handler';
import { guardTicketAccess } from '@/lib/api/module-guard';
import { isApiException } from '@/lib/api/subscription-guards';
import { requireTicketRouteAccess } from '@/lib/tenant/ticket-route-guard';
import { prisma } from '@/lib/prisma';
import { rejectIfOutsideCompanyPipeline } from '@/lib/pipelines/assert-stage';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    await guardTicketAccess(session?.user);

    const guard = await requireTicketRouteAccess(session, request, id);
    if (!guard.ok) return guard.response;

    const ticket = await ticketService.getTicketDetails(id, {
      hideInternal: guard.session.user.role === 'CUSTOMER',
    });

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    return NextResponse.json(ticket);
  } catch (error) {
    if (!isApiException(error)) {
      console.error('Error fetching ticket details:', error);
    }
    return handleApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    await guardTicketAccess(session?.user);

    const guard = await requireTicketRouteAccess(session, request, id);
    if (!guard.ok) return guard.response;

    const data = await request.json();
    const userId = guard.session.user.id;

    let result;

    if (data.status) {
      const existing = await prisma.supportTicket.findUnique({
        where: { id },
        select: { customer: { select: { companyId: true } } },
      });
      const rejected = await rejectIfOutsideCompanyPipeline(
        existing?.customer?.companyId,
        'tickets',
        data.status
      );
      if (rejected) return rejected;

      result = await ticketService.updateStatus(id, data.status, userId);
    } else if (data.toTechnicianId) {
      result = await ticketService.transferTicket(
        id,
        data.toTechnicianId,
        data.reason || 'No reason provided',
        userId
      );
    } else {
      return NextResponse.json(
        { error: 'No valid update field provided (status or toTechnicianId)' },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    if (!isApiException(error)) {
      console.error('Error updating ticket:', error);
    }
    return handleApiError(error);
  }
}
