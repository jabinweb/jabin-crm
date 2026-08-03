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

    if (guard.session.user.role === 'CUSTOMER') {
      return NextResponse.json(
        { error: 'Customers cannot change ticket status or assignment' },
        { status: 403 }
      );
    }

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
      const { dispatchWorkflowEvent } = await import('@/lib/workflows/executor');
      void dispatchWorkflowEvent('ticket.updated', {
        userId,
        ticketId: id,
        companyId: existing?.customer?.companyId,
        title: 'Ticket updated',
        summary: `Ticket status → ${data.status}`,
        metadata: { status: data.status },
      });
    } else if (data.toTechnicianId) {
      result = await ticketService.transferTicket(
        id,
        data.toTechnicianId,
        data.reason || 'No reason provided',
        userId
      );
    } else if (
      data.scheduledFor !== undefined ||
      data.estimatedDurationMin !== undefined ||
      data.assignedTechnicianId !== undefined
    ) {
      const updateData: {
        scheduledFor?: Date | null;
        estimatedDurationMin?: number | null;
        assignedTechnicianId?: string | null;
        status?: string;
      } = {};
      if (data.scheduledFor !== undefined) {
        updateData.scheduledFor = data.scheduledFor
          ? new Date(data.scheduledFor)
          : null;
      }
      if (data.estimatedDurationMin !== undefined) {
        updateData.estimatedDurationMin =
          data.estimatedDurationMin === null || data.estimatedDurationMin === ''
            ? null
            : Number(data.estimatedDurationMin);
      }
      if (data.assignedTechnicianId !== undefined) {
        updateData.assignedTechnicianId = data.assignedTechnicianId || null;
        if (data.assignedTechnicianId) {
          updateData.status = 'ASSIGNED';
        }
      }
      result = await prisma.supportTicket.update({
        where: { id },
        data: updateData,
        include: {
          assignedTechnician: { select: { id: true, name: true } },
          customer: { select: { organizationName: true } },
        },
      });
    } else {
      return NextResponse.json(
        {
          error:
            'No valid update field provided (status, toTechnicianId, scheduledFor, or assignedTechnicianId)',
        },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error) {
      const code = (error as { code?: string }).code;
      if (code === 'VISIT_LIMIT_EXCEEDED' || code === 'PHOTO_EVIDENCE_REQUIRED') {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Request blocked', code },
          { status: 400 }
        );
      }
    }
    if (!isApiException(error)) {
      console.error('Error updating ticket:', error);
    }
    return handleApiError(error);
  }
}
