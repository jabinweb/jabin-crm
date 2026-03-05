import { prisma } from '@/lib/prisma';
import Papa from 'papaparse';

export class ClientHistoryService {
    /**
     * Export a customer's full history to CSV format
     */
    async exportCustomerHistoryToCSV(customerId: string) {
        const customer = await prisma.customer.findUnique({
            where: { id: customerId },
            include: {
                equipmentInstallations: {
                    include: { product: true },
                },
                supportTickets: {
                    include: {
                        serviceReports: true,
                        assignedTechnician: { select: { name: true } },
                    },
                },
                activities: true,
            },
        });

        if (!customer) throw new Error('Customer not found');

        const data: any[] = [];

        // 1. Add equipment summary
        customer.equipmentInstallations.forEach((eq) => {
            data.push({
                Type: 'EQUIPMENT',
                Date: eq.installationDate.toISOString(),
                Item: eq.product.name,
                Details: `S/N: ${eq.serialNumber || 'N/A'}`,
                Status: eq.status,
            });
        });

        // 2. Add tickets and their service reports
        customer.supportTickets.forEach((ticket) => {
            data.push({
                Type: 'TICKET',
                Date: ticket.createdAt.toISOString(),
                Item: ticket.subject,
                Details: ticket.description,
                Status: ticket.status,
            });

            ticket.serviceReports.forEach((report) => {
                data.push({
                    Type: 'SERVICE_REPORT',
                    Date: report.createdAt.toISOString(),
                    Item: `Report for: ${ticket.subject}`,
                    Details: report.serviceNotes,
                    Status: 'FILED',
                });
            });
        });

        // 3. Add activities
        customer.activities.forEach((activity) => {
            data.push({
                Type: 'ACTIVITY',
                Date: activity.createdAt.toISOString(),
                Item: activity.eventType,
                Details: activity.description,
                Status: 'LOGGED',
            });
        });

        // Sort by date desc
        data.sort((a, b) => new Date(b.Date).getTime() - new Date(a.Date).getTime());

        return Papa.unparse(data);
    }

    /**
     * Get formatted history data for a customer profile view
     */
    async getFormattedHistory(customerId: string) {
        return await prisma.customerActivity.findMany({
            where: { customerId },
            orderBy: { createdAt: 'desc' },
            take: 50
        });
    }
}

export const clientHistoryService = new ClientHistoryService();
