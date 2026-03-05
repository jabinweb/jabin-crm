import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ticketService } from '@/lib/crm/ticket-service';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const ticket = await ticketService.getTicketDetails(id);

        if (!ticket) {
            return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
        }

        return NextResponse.json(ticket);
    } catch (error) {
        console.error('Error fetching ticket details:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const data = await request.json();
        const userId = session.user.id;

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
        console.error('Error updating ticket:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
