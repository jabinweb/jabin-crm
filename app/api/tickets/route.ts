import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ticketService } from '@/lib/crm/ticket-service';
import { ticketNotifications } from '@/lib/email/ticket-notifications';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status') || undefined;
        const priority = searchParams.get('priority') || undefined;
        const customerId = searchParams.get('customerId') || undefined;
        const technicianId = searchParams.get('technicianId') || undefined;

        const where: any = {};
        if (session.user.role === 'CUSTOMER') {
            where.customerId = session.user.customerId;
        } else {
            if (status) where.status = status;
            if (priority) where.priority = priority;
            if (customerId) where.customerId = customerId;
            if (technicianId) where.assignedTechnicianId = technicianId;
        }

        const tickets = await prisma.supportTicket.findMany({
            where,
            include: {
                customer: { select: { hospitalName: true } },
                assignedTechnician: { select: { name: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json(tickets);
    } catch (error) {
        console.error('Error fetching tickets:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const data = await request.json();

        // Enforce customerId from session for CUSTOMER role
        if (session.user.role === 'CUSTOMER') {
            data.customerId = session.user.customerId;
        }

        if (!data.customerId || !data.subject || !data.description) {
            return NextResponse.json({ error: 'Customer ID, subject, and description are required' }, { status: 400 });
        }

        const ticket = await ticketService.createTicket(data);

        // Async: Notify customer and technician (don't await to avoid slowing down response)
        if (ticket.customer.email) {
            ticketNotifications.notifyTicketCreated({
                customerEmail: ticket.customer.email,
                customerName: ticket.customer.contactPerson,
                ticketId: ticket.id,
                subject: ticket.subject,
            }).catch(err => console.error('Email notification failed:', err));
        }

        if (ticket.assignedTechnicianId && ticket.assignedTechnician?.email) {
            ticketNotifications.notifyTechnicianAssigned({
                technicianEmail: ticket.assignedTechnician.email,
                technicianName: ticket.assignedTechnician.name || 'Technician',
                ticketId: ticket.id,
                subject: ticket.subject,
                hospitalName: ticket.customer.hospitalName
            }).catch(err => console.error('Technician notification failed:', err));
        }

        return NextResponse.json(ticket, { status: 201 });
    } catch (error) {
        console.error('Error creating ticket:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
