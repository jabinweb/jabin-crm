import { sendEmail, createEmailHTML } from './nodemailer';

export async function sendWarrantyExpiryAlert(params: {
    customerEmail: string;
    customerName: string;
    equipmentName: string;
    serialNumber?: string | null;
    warrantyExpiry: Date;
    daysRemaining: number;
}) {
    const { customerEmail, customerName, equipmentName, serialNumber, warrantyExpiry, daysRemaining } = params;

    const body = `
Hello ${customerName},

This is an automated reminder that the warranty for one of your installed units is expiring soon.

Equipment: ${equipmentName}${serialNumber ? `\nSerial Number: ${serialNumber}` : ''}
Warranty Expiry: ${warrantyExpiry.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
Days Remaining: ${daysRemaining}

Please contact support to discuss warranty renewal or maintenance options before the expiry date.

Best regards,
The support team
    `;

    return sendEmail({
        to: customerEmail,
        subject: `⚠️ Warranty Expiring in ${daysRemaining} Days – ${equipmentName}`,
        html: createEmailHTML(body),
    });
}

export async function sendServiceReportEmail(params: {
    customerEmail: string;
    customerName: string;
    ticketSubject: string;
    ticketId: string;
    serviceNotes: string;
    technicianName: string;
    nextMaintenanceDate?: Date | null;
}) {
    const { customerEmail, customerName, ticketSubject, ticketId, serviceNotes, technicianName, nextMaintenanceDate } = params;

    const body = `
Hello ${customerName},

A service report has been completed for your recent support request.

Ticket: ${ticketSubject} [#${ticketId.slice(-6).toUpperCase()}]
Technician: ${technicianName}

Service Notes:
${serviceNotes}

${nextMaintenanceDate ? `Next Scheduled Maintenance: ${nextMaintenanceDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}` : ''}

You can view the full service report in your portal at any time.

Best regards,
The support team
    `;

    return sendEmail({
        to: customerEmail,
        subject: `Service Report Ready: ${ticketSubject} [#${ticketId.slice(-6).toUpperCase()}]`,
        html: createEmailHTML(body),
    });
}

export async function sendTicketStatusEmail(params: {
    customerEmail: string;
    customerName: string;
    ticketSubject: string;
    ticketId: string;
    newStatus: string;
}) {
    const { customerEmail, customerName, ticketSubject, ticketId, newStatus } = params;

    const statusLabel: Record<string, string> = {
        IN_PROGRESS: 'In Progress – A team member is working on your request.',
        RESOLVED: 'Resolved – Your issue has been resolved.',
        CLOSED: 'Closed – Your support ticket has been closed.',
        ASSIGNED: 'Assigned – Someone from the team has been assigned to your request.',
    };

    const body = `
Hello ${customerName},

Your support request has been updated.

Ticket: ${ticketSubject} [#${ticketId.slice(-6).toUpperCase()}]
New Status: ${statusLabel[newStatus] ?? newStatus}

You can track the full progress of your ticket in your customer portal.

Best regards,
The support team
    `;

    return sendEmail({
        to: customerEmail,
        subject: `Ticket Update: ${ticketSubject} [#${ticketId.slice(-6).toUpperCase()}]`,
        html: createEmailHTML(body),
    });
}
