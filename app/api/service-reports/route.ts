import { NextRequest, NextResponse } from 'next/server';
import { serviceReportService } from '@/lib/crm/service-report-service';
import { handleApiError } from '@/lib/api-error-handler';
import { withModuleAccess } from '@/lib/api/module-guard';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';
import { isApiException } from '@/lib/api/subscription-guards';

export const GET = withTenantRoute(async (_req, { companyId }) => {
    await withModuleAccess('SERVICE_REPORTS');
    const reports = await serviceReportService.listReportsForCompany(companyId);
    return jsonOk({ reports });
});

export async function POST(request: NextRequest) {
    try {
        const session = await withModuleAccess('SERVICE_REPORTS');

        const data = await request.json();
        const technicianId = session.user.id;

        if (!data.ticketId || !data.serviceNotes) {
            return NextResponse.json({ error: 'Ticket ID and service notes are required' }, { status: 400 });
        }

        const report = await serviceReportService.createReport({
            ...data,
            technicianId,
        });

        if (report.ticket.customer.email) {
            const { notifyPortalCustomer } = await import('@/lib/portal/notify-customer');
            const { sendServiceReportEmail } = await import('@/lib/email/portal-notifications');

            void notifyPortalCustomer({
                customerId: report.ticket.customerId,
                category: 'maintenanceReminders',
                type: 'SERVICE_REPORT_READY',
                title: 'Service report ready',
                body: `A service report has been completed for your ticket: "${report.ticket.subject}".`,
                metadata: { ticketId: report.ticketId, reportId: report.id },
                email: {
                    send: () =>
                        sendServiceReportEmail({
                            customerEmail: report.ticket.customer.email!,
                            customerName: report.ticket.customer.contactPerson,
                            ticketSubject: report.ticket.subject,
                            ticketId: report.ticketId,
                            serviceNotes: report.serviceNotes.slice(0, 500),
                            technicianName: session.user.name ?? 'Technician',
                            nextMaintenanceDate: report.nextMaintenanceDate,
                        }),
                },
            });
        }

        return NextResponse.json(report, { status: 201 });
    } catch (error) {
        if (!isApiException(error)) {
            console.error('Error creating service report:', error);
        }
        return handleApiError(error);
    }
}
