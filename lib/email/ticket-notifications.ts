import { sendEmail, createEmailHTML } from './nodemailer';

export class TicketNotifications {
    /**
     * Notify customer when a ticket is created
     */
    async notifyTicketCreated(params: {
        customerEmail: string;
        customerName: string;
        ticketId: string;
        subject: string;
    }) {
        const { customerEmail, customerName, ticketId, subject } = params;

        const body = `
      Hello ${customerName},

      We have received your support request regarding "${subject}".
      Our team is currently reviewing it and will assign a technician shortly.

      Ticket ID: ${ticketId}
      
      You can track the status of your ticket in the Jabin CRM portal.

      Best regards,
      The Jabin CRM Support Team
    `;

        const html = createEmailHTML(body);

        return await sendEmail({
            to: customerEmail,
            subject: `Support Ticket Received: ${subject} [#${ticketId.slice(-6)}]`,
            html,
        });
    }

    /**
     * Notify technician when a ticket is assigned to them
     */
    async notifyTechnicianAssigned(params: {
        technicianEmail: string;
        technicianName: string;
        ticketId: string;
        subject: string;
        hospitalName: string;
    }) {
        const { technicianEmail, technicianName, ticketId, subject, hospitalName } = params;

        const body = `
      Hello ${technicianName},

      A new support ticket has been assigned to you.

      Hospital/Client: ${hospitalName}
      Ticket Subject: ${subject}
      Ticket ID: ${ticketId}

      Please log in to the Jabin CRM dashboard to view full details and begin resolution.

      Best regards,
      Jabin CRM System
    `;

        const html = createEmailHTML(body);

        return await sendEmail({
            to: technicianEmail,
            subject: `New Ticket Assigned: ${hospitalName} - ${subject}`,
            html,
        });
    }

    /**
     * Notify customer when a ticket is resolved
     */
    async notifyTicketResolved(params: {
        customerEmail: string;
        customerName: string;
        ticketId: string;
        subject: string;
        reportSummary?: string;
    }) {
        const { customerEmail, customerName, ticketId, subject, reportSummary } = params;

        const body = `
      Hello ${customerName},

      Great news! Your support ticket "${subject}" has been marked as resolved.

      ${reportSummary ? `Service Summary:\n${reportSummary}\n` : ''}
      
      You can view the full service report in your dashboard.
      If you have further questions, please reply to this email or reopen the ticket.

      Best regards,
      The Jabin CRM Support Team
    `;

        const html = createEmailHTML(body);

        return await sendEmail({
            to: customerEmail,
            subject: `Ticket Resolved: ${subject} [#${ticketId.slice(-6)}]`,
            html,
        });
    }
}

export const ticketNotifications = new TicketNotifications();
