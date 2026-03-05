import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { serviceReportService } from '@/lib/crm/service-report-service';
import { ticketNotifications } from '@/lib/email/ticket-notifications';

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const data = await request.json();
        const technicianId = session.user.id;

        if (!data.ticketId || !data.serviceNotes) {
            return NextResponse.json({ error: 'Ticket ID and service notes are required' }, { status: 400 });
        }

        const report = await serviceReportService.createReport({
            ...data,
            technicianId,
        });

        // Async: Notify customer via email + create DB notification
        if (report.ticket.customer.email) {
            const { notificationService } = await import('@/lib/crm/notification-service');
            const { sendServiceReportEmail } = await import('@/lib/email/portal-notifications');

            // DB notification in portal bell
            notificationService.create({
                type: 'SERVICE_REPORT_READY',
                title: 'Service Report Ready',
                body: `A service report has been completed for your ticket: "${report.ticket.subject}".`,
                customerId: report.ticket.customerId,
                metadata: { ticketId: report.ticketId, reportId: report.id },
            }).catch(err => console.error('[Notification create error]', err));

            // Email with service notes preview
            sendServiceReportEmail({
                customerEmail: report.ticket.customer.email,
                customerName: report.ticket.customer.contactPerson,
                ticketSubject: report.ticket.subject,
                ticketId: report.ticketId,
                serviceNotes: report.serviceNotes.slice(0, 500),
                technicianName: session.user.name ?? 'Technician',
                nextMaintenanceDate: report.nextMaintenanceDate,
            }).catch(err => console.error('[Service report email error]', err));
        }

        return NextResponse.json(report, { status: 201 });
    } catch (error) {
        console.error('Error creating service report:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
