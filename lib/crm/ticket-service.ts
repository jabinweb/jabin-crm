import { prisma } from '@/lib/prisma';
import { TicketPriority, TicketStatus } from '@prisma/client';

export interface CreateTicketData {
    customerId: string;
    equipmentId?: string;
    subject: string;
    description: string;
    priority?: TicketPriority;
    channel?: 'EMAIL' | 'PORTAL' | 'PHONE' | 'WHATSAPP' | 'CHAT' | 'API';
    groupId?: string;
    tags?: string[];
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
                channel: data.channel || 'PORTAL',
                groupId: data.groupId,
                tags: data.tags ?? [],
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
            where: { role: { in: ['TECHNICIAN', 'SUPPORT_MANAGER'] } },
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
                customer: { select: { id: true, organizationName: true, email: true, contactPerson: true } },
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
    async addComment(
        ticketId: string,
        comment: string,
        performedById: string,
        options?: { isInternal?: boolean }
    ) {
        return await this.logActivity(
            ticketId,
            options?.isInternal ? 'INTERNAL_NOTE' : 'COMMENT',
            comment,
            performedById,
            undefined,
            options?.isInternal ?? false
        );
    }

    /**
     * Log a ticket activity
     */
    async logActivity(
        ticketId: string,
        eventType: string,
        description: string,
        performedById?: string,
        metadata?: any,
        isInternal = false
    ) {
        return await prisma.ticketActivity.create({
            data: {
                ticketId,
                eventType,
                description,
                performedById,
                metadata: metadata || {},
                isInternal,
            },
        });
    }

    async submitCsat(ticketId: string, rating: number, comment?: string) {
        if (rating < 1 || rating > 5) throw new Error('Rating must be 1–5');
        return prisma.supportTicket.update({
            where: { id: ticketId },
            data: {
                csatRating: rating,
                csatComment: comment,
                csatSubmittedAt: new Date(),
            },
        });
    }

    /**
     * Get ticket details with full history
     */
    async getTicketDetails(id: string, options?: { hideInternal?: boolean }) {
        const ticket = await prisma.supportTicket.findUnique({
            where: { id },
            include: {
                customer: true,
                equipment: {
                    include: { product: true },
                },
                assignedTechnician: {
                    select: { id: true, name: true, email: true },
                },
                group: { select: { id: true, name: true, email: true } },
                activities: {
                    where: options?.hideInternal ? { isInternal: false } : undefined,
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
        return ticket;
    }

    /** Merge secondary tickets into a primary ticket */
    async mergeTickets(primaryId: string, secondaryIds: string[], performedById?: string) {
        const primary = await prisma.supportTicket.findUnique({ where: { id: primaryId } });
        if (!primary) throw new Error('Primary ticket not found');

        const ids = secondaryIds.filter((id) => id !== primaryId);
        if (ids.length === 0) throw new Error('No tickets to merge');

        await prisma.$transaction(async (tx) => {
            for (const secondaryId of ids) {
                const secondary = await tx.supportTicket.findUnique({
                    where: { id: secondaryId },
                    include: { activities: true },
                });
                if (!secondary || secondary.mergedIntoId) continue;

                for (const activity of secondary.activities) {
                    await tx.ticketActivity.create({
                        data: {
                            ticketId: primaryId,
                            eventType: activity.eventType,
                            description: `[Merged from #${secondaryId.slice(-6)}] ${activity.description}`,
                            performedById: activity.performedById,
                            isInternal: activity.isInternal,
                            metadata: { mergedFrom: secondaryId, ...(activity.metadata as object) },
                            createdAt: activity.createdAt,
                        },
                    });
                }

                await tx.supportTicket.update({
                    where: { id: secondaryId },
                    data: {
                        mergedIntoId: primaryId,
                        status: 'CLOSED',
                    },
                });
            }

            await tx.ticketActivity.create({
                data: {
                    ticketId: primaryId,
                    eventType: 'MERGED',
                    description: `Merged ${ids.length} ticket(s) into this request`,
                    performedById,
                    metadata: { mergedTicketIds: ids },
                },
            });
        });

        return this.getTicketDetails(primaryId);
    }

    /** Split a new ticket from an existing one */
    async splitTicket(
        sourceId: string,
        data: { subject: string; description: string },
        performedById?: string
    ) {
        const source = await prisma.supportTicket.findUnique({ where: { id: sourceId } });
        if (!source) throw new Error('Source ticket not found');

        const newTicket = await prisma.supportTicket.create({
            data: {
                customerId: source.customerId,
                equipmentId: source.equipmentId,
                groupId: source.groupId,
                subject: data.subject,
                description: data.description,
                priority: source.priority,
                channel: source.channel,
                tags: source.tags,
                status: 'OPEN',
            },
        });

        await this.logActivity(
            sourceId,
            'SPLIT',
            `Split new ticket #${newTicket.id.slice(-6)}: ${data.subject}`,
            performedById,
            { splitTicketId: newTicket.id }
        );
        await this.logActivity(
            newTicket.id,
            'CREATED',
            `Created from split of ticket #${sourceId.slice(-6)}`,
            performedById,
            { sourceTicketId: sourceId }
        );

        return newTicket;
    }
}

export const ticketService = new TicketService();
