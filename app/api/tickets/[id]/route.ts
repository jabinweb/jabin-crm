import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ticketService } from '@/lib/crm/ticket-service';
import { handleApiError } from '@/lib/api-error-handler';
import { guardTicketAccess } from '@/lib/api/module-guard';
import { isApiException } from '@/lib/api/subscription-guards';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const session = await auth();
        await guardTicketAccess(session?.user);

        const ticket = await ticketService.getTicketDetails(id, {
            hideInternal: session!.user.role === 'CUSTOMER',
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

        const data = await request.json();
        const userId = session!.user.id;

        let result;

        if (data.status) {
            result = await ticketService.updateStatus(id, data.status, userId);
        } else if (data.toTechnicianId) {
            result = await ticketService.transferTicket(
                id,
                data.toTechnicianId,
                data.reason || 'No reason provided',
                userId
            );
        } else {
            return NextResponse.json({ error: 'No valid update field provided (status or toTechnicianId)' }, { status: 400 });
        }

        return NextResponse.json(result);
    } catch (error) {
        if (!isApiException(error)) {
            console.error('Error updating ticket:', error);
        }
        return handleApiError(error);
    }
}
