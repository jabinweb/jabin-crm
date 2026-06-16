import { sendEmail, createEmailHTML } from './nodemailer';
import { getBrandConfig } from '@/lib/branding';

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
        const brand = getBrandConfig();

        const body = `
      Hello ${customerName},

      We have received your support request regarding "${subject}".
      Our team is currently reviewing it and will assign a technician shortly.

      Ticket ID: ${ticketId}
      
      You can track the status of your ticket in the ${brand.appName} portal.

      Best regards,
      ${brand.supportTeamName}
    `;

        const html = createEmailHTML(body);

        return await sendEmail({
            to: customerEmail,
            subject: `[${brand.appName}] Support Ticket Received: ${subject} [#${ticketId.slice(-6)}]`,
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
        organizationName: string;
    }) {
        const { technicianEmail, technicianName, ticketId, subject, organizationName } = params;
        const brand = getBrandConfig();

        const body = `
      Hello ${technicianName},

      A new support ticket has been assigned to you.

      Account: ${organizationName}
      Ticket Subject: ${subject}
      Ticket ID: ${ticketId}

      Please log in to the ${brand.appName} dashboard to view full details and begin resolution.

      Best regards,
      ${brand.systemName}
    `;

        const html = createEmailHTML(body);

        return await sendEmail({
            to: technicianEmail,
            subject: `[${brand.appName}] New Ticket Assigned: ${organizationName} - ${subject}`,
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
        const brand = getBrandConfig();

        const body = `
      Hello ${customerName},

      Great news! Your support ticket "${subject}" has been marked as resolved.

      ${reportSummary ? `Service Summary:\n${reportSummary}\n` : ''}
      
      You can view the full service report in your dashboard.
      If you have further questions, please reply to this email or reopen the ticket.

      Best regards,
      ${brand.supportTeamName}
    `;

        const html = createEmailHTML(body);

        return await sendEmail({
            to: customerEmail,
            subject: `[${brand.appName}] Ticket Resolved: ${subject} [#${ticketId.slice(-6)}]`,
            html,
        });
    }
}

export const ticketNotifications = new TicketNotifications();
