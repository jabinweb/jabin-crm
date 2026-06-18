import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ticketService } from '@/lib/crm/ticket-service';
import { ticketNotifications } from '@/lib/email/ticket-notifications';
import { prisma } from '@/lib/prisma';
import { ensureFeatureEnabled } from '@/lib/feature-modules';
import { handleApiError } from '@/lib/api-error-handler';
import { createPortalTicket } from '@/lib/support/create-portal-ticket';
import {
  findTicketTypeDefinition,
  validateCustomFields,
} from '@/lib/support/ticket-types';
import {
  resolveCompanyTicketConfig,
  resolveGroupIdForTicketType,
} from '@/lib/support/resolve-company-ticket-config';

export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status') || undefined;
        const priority = searchParams.get('priority') || undefined;
        const channel = searchParams.get('channel') || undefined;
        const customerId = searchParams.get('customerId') || undefined;
        const technicianId = searchParams.get('technicianId') || undefined;
        const includeMerged = searchParams.get('includeMerged') === 'true';

        if (session.user.role !== 'CUSTOMER') {
            if (channel) {
                await ensureFeatureEnabled(session.user.id, 'SUPPORT_INBOX');
            } else {
                await ensureFeatureEnabled(session.user.id, 'TICKETS');
            }
        }

        const where: Record<string, unknown> = {};
        if (session.user.role === 'CUSTOMER') {
            where.customerId = session.user.customerId;
        } else {
            if (!includeMerged) where.mergedIntoId = null;
            if (status) where.status = status;
            if (priority) where.priority = priority;
            if (channel) where.channel = channel;
            if (customerId) where.customerId = customerId;
            if (technicianId) where.assignedTechnicianId = technicianId;
        }

        const tickets = await prisma.supportTicket.findMany({
            where,
            include: {
                customer: { select: { organizationName: true } },
                assignedTechnician: { select: { name: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json(tickets);
    } catch (error) {
        const handled = handleApiError(error);
        if (handled.status !== 500) return handled;
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

        if (session.user.role !== 'CUSTOMER') {
            await ensureFeatureEnabled(session.user.id, 'TICKETS');
        }

        const data = await request.json();

        // Enforce customerId from session for CUSTOMER role
        if (session.user.role === 'CUSTOMER') {
            data.customerId = session.user.customerId;
        }

        if (!data.customerId || !data.subject || !data.description) {
            return NextResponse.json({ error: 'Customer ID, subject, and description are required' }, { status: 400 });
        }

        let ticket;

        if (session.user.role === 'CUSTOMER') {
            if (!data.ticketType) {
                return NextResponse.json({ error: 'Ticket type is required' }, { status: 400 });
            }
            try {
                ticket = await createPortalTicket(session.user.customerId!, {
                    ticketType: String(data.ticketType),
                    subject: String(data.subject),
                    description: String(data.description),
                    priority: data.priority,
                    equipmentId: data.equipmentId,
                    customFields: data.customFields,
                });
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Invalid ticket data';
                return NextResponse.json({ error: message }, { status: 400 });
            }
        } else {
            if (data.ticketType) {
                const customer = await prisma.customer.findUnique({
                    where: { id: data.customerId },
                    select: { companyId: true },
                });
                const { ticketTypes } = await resolveCompanyTicketConfig(customer?.companyId);
                const typeDef = findTicketTypeDefinition(ticketTypes, String(data.ticketType));
                if (typeDef) {
                    const fieldError = validateCustomFields(typeDef, data.customFields);
                    if (fieldError) {
                        return NextResponse.json({ error: fieldError }, { status: 400 });
                    }
                    data.groupId =
                        data.groupId ??
                        (await resolveGroupIdForTicketType(customer?.companyId, typeDef));
                    data.priority = data.priority ?? typeDef.defaultPriority;
                }
            }
            ticket = await ticketService.createTicket(data);
        }

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
                organizationName: ticket.customer.organizationName
            }).catch(err => console.error('Technician notification failed:', err));
        }

        return NextResponse.json(ticket, { status: 201 });
    } catch (error) {
        console.error('Error creating ticket:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
