import { prisma } from '@/lib/prisma';
import { TicketPriority, TicketStatus } from '@prisma/client';

export interface CreateTicketData {
    customerId: string;
    equipmentId?: string;
    subject: string;
    description: string;
    priority?: TicketPriority;
}

export class TicketService {
    /**
     * Create a new support ticket and auto-assign a technician
     */
    async createTicket(data: CreateTicketData) {
        // 1. Find technician for assignment (Round-robin / Least busy)
        const technician = await this.getNextAvailableTechnician();

        // 2. Create the ticket
        const ticket = await prisma.supportTicket.create({
            data: {
                customerId: data.customerId,
                equipmentId: data.equipmentId,
                subject: data.subject,
                description: data.description,
                priority: data.priority || 'MEDIUM',
                status: technician ? 'ASSIGNED' : 'OPEN',
                assignedTechnicianId: technician?.id,
            },
            include: {
                customer: true,
                assignedTechnician: {
                    select: { name: true, email: true },
                },
            },
        });

        // 3. Log initial activity
        await this.logActivity(ticket.id, 'CREATED', `Ticket created: ${ticket.subject}`);

        if (technician) {
            await this.logActivity(ticket.id, 'ASSIGNED', `Ticket automatically assigned to ${technician.name}`, technician.id);
        }

        // 4. Log activity on customer record
        await prisma.customerActivity.create({
            data: {
                customerId: data.customerId,
                eventType: 'TICKET_CREATED',
                description: `New support ticket: ${ticket.subject} (ID: ${ticket.id})`,
                metadata: { ticketId: ticket.id },
            },
        });

        return ticket;
    }

    /**
     * Get the next technician using a "least busy" strategy
     */
    private async getNextAvailableTechnician() {
        const technicians = await prisma.user.findMany({
            where: { role: 'TECHNICIAN' },
            select: {
                id: true,
                name: true,
                _count: {
                    select: {
                        assignedTickets: {
                            where: { status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] } },
                        },
                    },
                },
            },
        });

        if (technicians.length === 0) return null;

        // Sort by count of active tickets and return the first
        return technicians.sort((a, b) => a._count.assignedTickets - b._count.assignedTickets)[0];
    }

    /**
     * Update ticket status — fires email to customer + creates Notification record
     */
    async updateStatus(ticketId: string, status: TicketStatus, performedById?: string) {
        const ticket = await prisma.supportTicket.update({
            where: { id: ticketId },
            data: { status },
            include: {
                customer: { select: { id: true, hospitalName: true, email: true, contactPerson: true } },
            },
        });

        await this.logActivity(ticketId, 'STATUS_CHANGED', `Status changed to ${status}`, performedById);

        // Fire email + notification for customer-visible statuses
        const notifyStatuses: TicketStatus[] = ['ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
        if (notifyStatuses.includes(status) && ticket.customer?.email) {
            const { notificationService } = await import('@/lib/crm/notification-service');
            const { sendTicketStatusEmail } = await import('@/lib/email/portal-notifications');

            // DB notification (visible in portal bell)
            notificationService.create({
                type: status === 'RESOLVED' ? 'TICKET_RESOLVED' : 'TICKET_UPDATED',
                title: status === 'RESOLVED' ? `Ticket Resolved` : `Ticket Update`,
                body: `Your ticket "${ticket.subject}" status changed to ${status}.`,
                customerId: ticket.customer.id,
                metadata: { ticketId: ticket.id, status },
            }).catch(err => console.error('[Notification create error]', err));

            // Email
            sendTicketStatusEmail({
                customerEmail: ticket.customer.email,
                customerName: ticket.customer.contactPerson,
                ticketSubject: ticket.subject,
                ticketId: ticket.id,
                newStatus: status,
            }).catch(err => console.error('[Status email error]', err));
        }

        return ticket;
    }


    /**
     * Transfer ticket to another technician
     */
    async transferTicket(ticketId: string, toTechnicianId: string, reason: string, performedById: string) {
        const ticket = await prisma.supportTicket.findUnique({
            where: { id: ticketId },
            select: { assignedTechnicianId: true },
        });

        if (!ticket) throw new Error('Ticket not found');

        // Create transfer history
        await prisma.ticketTransferHistory.create({
            data: {
                ticketId,
                fromTechnicianId: ticket.assignedTechnicianId,
                toTechnicianId,
                reason,
            },
        });

        // Update ticket assignment
        const updatedTicket = await prisma.supportTicket.update({
            where: { id: ticketId },
            data: {
                assignedTechnicianId: toTechnicianId,
                status: 'ASSIGNED',
            },
            include: {
                toTechnician: {
                    select: { name: true }
                }
            } as any // prisma doesn't always handle include nested on update nicely in types here
        });

        await this.logActivity(ticketId, 'TRANSFER', `Ticket transferred to another technician. Reason: ${reason}`, performedById);

        return updatedTicket;
    }

    /**
     * Add a comment/activity to a ticket
     */
    async addComment(ticketId: string, comment: string, performedById: string) {
        return await this.logActivity(ticketId, 'COMMENT', comment, performedById);
    }

    /**
     * Log a ticket activity
     */
    async logActivity(ticketId: string, eventType: string, description: string, performedById?: string, metadata?: any) {
        return await prisma.ticketActivity.create({
            data: {
                ticketId,
                eventType,
                description,
                performedById,
                metadata: metadata || {},
            },
        });
    }

    /**
     * Get ticket details with full history
     */
    async getTicketDetails(id: string) {
        return await prisma.supportTicket.findUnique({
            where: { id },
            include: {
                customer: true,
                equipment: {
                    include: { product: true },
                },
                assignedTechnician: {
                    select: { id: true, name: true, email: true },
                },
                activities: {
                    include: {
                        performedBy: { select: { name: true } },
                    },
                    orderBy: { createdAt: 'desc' },
                },
                serviceReports: {
                    include: {
                        technician: { select: { name: true } },
                    },
                },
                transferHistory: {
                    include: {
                        fromTechnician: { select: { name: true } },
                        toTechnician: { select: { name: true } },
                    },
                },
            },
        });
    }
}

export const ticketService = new TicketService();
