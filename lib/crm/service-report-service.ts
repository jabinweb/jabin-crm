import { prisma } from '@/lib/prisma';

export interface CreateServiceReportData {
    ticketId: string;
    technicianId: string;
    serviceNotes: string;
    partsReplaced?: string;
    nextMaintenanceDate?: Date;
    attachments?: any;
}

export class ServiceReportService {
    /**
     * Create a new service report for a ticket
     */
    async createReport(data: CreateServiceReportData) {
        const report = await prisma.serviceReport.create({
            data: {
                ticketId: data.ticketId,
                technicianId: data.technicianId,
                serviceNotes: data.serviceNotes,
                partsReplaced: data.partsReplaced,
                nextMaintenanceDate: data.nextMaintenanceDate,
                attachments: data.attachments || {},
            },
            include: {
                ticket: {
                    include: {
                        customer: true,
                    },
                },
            },
        });

        // 1. Update ticket status to RESOLVED automatically when a report is filed
        await prisma.supportTicket.update({
            where: { id: data.ticketId },
            data: { status: 'RESOLVED' },
        });

        // 2. Log activity on the ticket
        await prisma.ticketActivity.create({
            data: {
                ticketId: data.ticketId,
                eventType: 'SERVICE_REPORT',
                description: `Service report filed by technician. Ticket marked as RESOLVED.`,
                performedById: data.technicianId,
                metadata: { reportId: report.id },
            },
        });

        // 3. Log activity on the customer record
        await prisma.customerActivity.create({
            data: {
                customerId: report.ticket.customerId,
                eventType: 'SERVICE_REPORT',
                description: `Service report received for ticket: ${report.ticket.subject}`,
                metadata: { reportId: report.id, ticketId: data.ticketId },
            },
        });

        return report;
    }

    /**
     * Get reports for a specific ticket
     */
    async getReportsByTicket(ticketId: string) {
        return await prisma.serviceReport.findMany({
            where: { ticketId },
            include: {
                technician: {
                    select: { name: true, email: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    /**
     * Get a specific report by ID
     */
    async getReportById(id: string) {
        return await prisma.serviceReport.findUnique({
            where: { id },
            include: {
                ticket: {
                    include: {
                        customer: true,
                        equipment: { include: { product: true } },
                    },
                },
                technician: {
                    select: { name: true, email: true },
                },
            },
        });
    }
}

export const serviceReportService = new ServiceReportService();
