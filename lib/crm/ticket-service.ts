import { prisma } from '@/lib/prisma';
import { TicketPriority, TicketStatus } from '@prisma/client';
import { getNextAvailableAgent } from '@/lib/support/ticket-assignment';
import { getSlaConfigForTicket } from '@/lib/crm/sla-policies';
import { parseSupportSettings } from '@/lib/support/ticket-types';
import {
  getStatusPipelineForTicketType,
  isValidStatusTransition,
} from '@/lib/support/status-pipelines';

export interface CreateTicketData {
    customerId: string;
    equipmentId?: string;
    subject: string;
    description: string;
    priority?: TicketPriority;
    channel?: 'EMAIL' | 'PORTAL' | 'PHONE' | 'WHATSAPP' | 'CHAT' | 'API';
    groupId?: string;
    tags?: string[];
    ticketType?: string;
    customFields?: Record<string, string>;
    companyId?: string | null;
}

function addHours(date: Date, hours: number): Date {
    return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

export class TicketService {
    /**
     * Create a new support ticket and auto-assign an agent (group-aware).
     */
    async createTicket(data: CreateTicketData) {
        const customer = await prisma.customer.findUnique({
            where: { id: data.customerId },
            select: { companyId: true },
        });
        const companyId = data.companyId ?? customer?.companyId ?? null;

        const agent = await getNextAvailableAgent({
            companyId,
            groupId: data.groupId,
        });

        const tags = [...(data.tags ?? [])];
        if (data.ticketType) {
            tags.push(`type:${data.ticketType}`);
        }

        let supportSettings;
        if (companyId) {
            const company = await prisma.company.findUnique({
                where: { id: companyId },
                select: { settings: true },
            });
            const stored =
                company?.settings && typeof company.settings === 'object' && !Array.isArray(company.settings)
                    ? (company.settings as Record<string, unknown>)
                    : {};
            supportSettings = parseSupportSettings(stored.support);
        }

        const priority = data.priority || 'MEDIUM';
        const sla = await getSlaConfigForTicket({
            priority,
            ticketType: data.ticketType,
            companyId,
            supportSettings,
        });

        const now = new Date();
        const metadata: Record<string, unknown> = {};
        if (data.customFields && Object.keys(data.customFields).length > 0) {
            metadata.customFields = data.customFields;
        }
        if (data.ticketType) {
            metadata.ticketType = data.ticketType;
        }

        const ticket = await prisma.supportTicket.create({
            data: {
                customerId: data.customerId,
                equipmentId: data.equipmentId || null,
                subject: data.subject,
                description: data.description,
                priority,
                channel: data.channel || 'PORTAL',
                groupId: data.groupId,
                ticketType: data.ticketType,
                tags,
                metadata,
                responseDueAt: addHours(now, sla.responseHours),
                resolutionDueAt: addHours(now, sla.resolutionHours),
                status: agent ? 'ASSIGNED' : 'OPEN',
                assignedTechnicianId: agent?.id,
            },
            include: {
                customer: true,
                assignedTechnician: {
                    select: { name: true, email: true },
                },
            },
        });

        await this.logActivity(
            ticket.id,
            'CREATED',
            `Ticket created: ${ticket.subject}`,
            undefined,
            Object.keys(metadata).length > 0 ? metadata : undefined
        );

        if (agent) {
            await this.logActivity(
                ticket.id,
                'ASSIGNED',
                `Ticket automatically assigned to ${agent.name}`,
                agent.id
            );
        }

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
     * Update ticket status — validates against configured pipeline when available.
     */
    async updateStatus(ticketId: string, status: TicketStatus, performedById?: string) {
        const existing = await prisma.supportTicket.findUnique({
            where: { id: ticketId },
            select: {
                status: true,
                ticketType: true,
                customer: { select: { companyId: true } },
            },
        });

        if (!existing) throw new Error('Ticket not found');

        if (existing.customer?.companyId && existing.ticketType) {
            const company = await prisma.company.findUnique({
                where: { id: existing.customer.companyId },
                select: { settings: true },
            });
            const stored =
                company?.settings && typeof company.settings === 'object' && !Array.isArray(company.settings)
                    ? (company.settings as Record<string, unknown>)
                    : {};
            const supportSettings = parseSupportSettings(stored.support);
            const pipeline = getStatusPipelineForTicketType(existing.ticketType, supportSettings);
            if (!isValidStatusTransition(existing.status, status, pipeline)) {
                throw new Error(`Invalid status transition from ${existing.status} to ${status}`);
            }
        }

        const ticket = await prisma.supportTicket.update({
            where: { id: ticketId },
            data: { status },
            include: {
                customer: { select: { id: true, organizationName: true, email: true, contactPerson: true } },
            },
        });

        await this.logActivity(ticketId, 'STATUS_CHANGED', `Status changed to ${status}`, performedById);

        const notifyStatuses: TicketStatus[] = ['ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
        if (notifyStatuses.includes(status) && ticket.customer?.email) {
            const { notificationService } = await import('@/lib/crm/notification-service');
            const { sendTicketStatusEmail } = await import('@/lib/email/portal-notifications');

            notificationService.create({
                type: status === 'RESOLVED' ? 'TICKET_RESOLVED' : 'TICKET_UPDATED',
                title: status === 'RESOLVED' ? `Ticket Resolved` : `Ticket Update`,
                body: `Your ticket "${ticket.subject}" status changed to ${status}.`,
                customerId: ticket.customer.id,
                metadata: { ticketId: ticket.id, status },
            }).catch(err => console.error('[Notification create error]', err));

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

    async transferTicket(ticketId: string, toTechnicianId: string, reason: string, performedById: string) {
        const ticket = await prisma.supportTicket.findUnique({
            where: { id: ticketId },
            select: { assignedTechnicianId: true },
        });

        if (!ticket) throw new Error('Ticket not found');

        await prisma.ticketTransferHistory.create({
            data: {
                ticketId,
                fromTechnicianId: ticket.assignedTechnicianId,
                toTechnicianId,
                reason,
            },
        });

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
            } as any
        });

        await this.logActivity(ticketId, 'TRANSFER', `Ticket transferred to another agent. Reason: ${reason}`, performedById);

        return updatedTicket;
    }

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
                ticketType: source.ticketType,
                metadata: source.metadata ?? {},
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
