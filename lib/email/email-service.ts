import { prisma } from '../prisma';
import { Prisma } from '@prisma/client';
import { logError } from '@/lib/logger';

export interface EmailConfig {
  provider: 'smtp' | 'sendgrid' | 'resend';
  apiKey?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPassword?: string;
}

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
  fromName: string;
  fromEmail: string;
  replyTo?: string;
  trackingId?: string;
}

export class EmailService {
  private config: EmailConfig;

  constructor(config: EmailConfig) {
    this.config = config;
  }

  /**
   * Send a single email
   */
  async sendEmail(params: SendEmailParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      switch (this.config.provider) {
        case 'resend':
          return await this.sendWithResend(params);
        case 'sendgrid':
          return await this.sendWithSendGrid(params);
        case 'smtp':
          return await this.sendWithSMTP(params);
        default:
          throw new Error(`Unsupported email provider: ${this.config.provider}`);
      }
    } catch (error) {
      logError(error, { context: 'Error sending email' });
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Send email using Resend
   */
  private async sendWithResend(params: SendEmailParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${params.fromName} <${params.fromEmail}>`,
          to: [params.to],
          subject: params.subject,
          html: this.injectTrackingPixel(params.html, params.trackingId),
          text: params.text,
          reply_to: params.replyTo,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        return { success: true, messageId: data.id };
      } else {
        return { success: false, error: data.message || 'Failed to send email' };
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Send email using SendGrid
   */
  private async sendWithSendGrid(params: SendEmailParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{
            to: [{ email: params.to }],
            subject: params.subject,
          }],
          from: { email: params.fromEmail, name: params.fromName },
          reply_to: params.replyTo ? { email: params.replyTo } : undefined,
          content: [
            {
              type: 'text/html',
              value: this.injectTrackingPixel(params.html, params.trackingId),
            },
            params.text ? {
              type: 'text/plain',
              value: params.text,
            } : undefined,
          ].filter(Boolean),
        }),
      });

      if (response.ok) {
        const messageId = response.headers.get('x-message-id');
        return { success: true, messageId: messageId || undefined };
      } else {
        const error = await response.text();
        return { success: false, error };
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Send email using SMTP
   */
  private async sendWithSMTP(params: SendEmailParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
    // SMTP implementation would require nodemailer or similar
    // This is a placeholder
    throw new Error('SMTP not implemented yet');
  }

  /**
   * Inject tracking pixel for open tracking
   */
  private injectTrackingPixel(html: string, trackingId?: string): string {
    if (!trackingId) return html;

    const trackingPixel = `<img src="${process.env.AUTH_URL}/api/email/track/open/${trackingId}" width="1" height="1" style="display:none;" />`;

    // Try to inject before </body> tag
    if (html.includes('</body>')) {
      return html.replace('</body>', `${trackingPixel}</body>`);
    }

    // Otherwise append at the end
    return html + trackingPixel;
  }

  /**
   * Replace template variables with actual values
   */
  replaceVariables(template: string, variables: Record<string, string>): string {
    let result = template;

    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      result = result.replace(regex, value);
    }

    return result;
  }

  /**
   * Track links in email
   */
  trackLinks(html: string, trackingId: string): string {
    const urlRegex = /href="(https?:\/\/[^"]+)"/g;

    return html.replace(urlRegex, (match, url) => {
      const trackedUrl = `${process.env.AUTH_URL}/api/email/track/click/${trackingId}?url=${encodeURIComponent(url)}`;
      return `href="${trackedUrl}"`;
    });
  }
}

/**
 * Campaign manager for handling email campaigns
 */
export class CampaignManager {
  private emailService: EmailService;

  constructor(emailService: EmailService) {
    this.emailService = emailService;
  }

  /**
   * Send campaign to all recipients
   */
  async sendCampaign(campaignId: string): Promise<void> {
    const campaign = await prisma.emailCampaign.findUnique({
      where: { id: campaignId },
      include: {
        emailCampaignLeads: {
          where: { status: 'PENDING' },
          include: { lead: true },
        },
      },
    });

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    // Update campaign status
    await prisma.emailCampaign.update({
      where: { id: campaignId },
      data: { status: 'SENDING', sentAt: new Date() },
    });

    let sentCount = 0;
    let failedCount = 0;

    for (const campaignLead of campaign.emailCampaignLeads) {
      try {
        if (!campaignLead.lead.email) {
          await this.updateCampaignLeadStatus(campaignLead.id, 'FAILED', 'No email address');
          failedCount++;
          continue;
        }

        // Prepare email variables
        const variables = {
          companyName: campaignLead.lead.companyName || '',
          contactName: campaignLead.lead.contactName || '',
          industry: campaignLead.lead.industry || '',
          website: campaignLead.lead.website || '',
          email: campaignLead.lead.email || '',
          phone: campaignLead.lead.phone || '',
        };

        // Replace variables in subject and body
        const subject = this.emailService.replaceVariables(campaign.subject, variables);
        let html = this.emailService.replaceVariables(campaign.emailTemplate, variables);

        // Track links
        html = this.emailService.trackLinks(html, campaignLead.id);

        // Send email
        const result = await this.emailService.sendEmail({
          to: campaignLead.lead.email,
          subject,
          html,
          fromName: campaign.fromName,
          fromEmail: campaign.fromEmail,
          replyTo: campaign.replyTo || undefined,
          trackingId: campaignLead.id,
        });

        if (result.success) {
          await this.updateCampaignLeadStatus(campaignLead.id, 'SENT');

          // Log email event
          await prisma.emailEvent.create({
            data: {
              campaignId,
              leadEmail: campaignLead.lead.email,
              eventType: 'SENT',
              metadata: { messageId: result.messageId },
            },
          });

          // Update lead activity
          await prisma.leadActivity.create({
            data: {
              leadId: campaignLead.leadId,
              activityType: 'EMAIL_SENT',
              description: `Email sent: ${campaign.name}`,
              metadata: { campaignId, subject },
            },
          });

          sentCount++;
        } else {
          await this.updateCampaignLeadStatus(campaignLead.id, 'FAILED', result.error);
          failedCount++;
        }

        // Add delay between emails to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        logError(error, { context: 'Error sending email to lead', leadId: campaignLead.leadId });
        await this.updateCampaignLeadStatus(
          campaignLead.id,
          'FAILED',
          error instanceof Error ? error.message : 'Unknown error'
        );
        failedCount++;
      }
    }

    // Update campaign with final counts
    await prisma.emailCampaign.update({
      where: { id: campaignId },
      data: {
        status: 'SENT',
        sentCount: campaign.sentCount + sentCount,
      },
    });
  }

  /**
   * Schedule campaign for later
   */
  async scheduleCampaign(campaignId: string, scheduledAt: Date): Promise<void> {
    await prisma.emailCampaign.update({
      where: { id: campaignId },
      data: {
        status: 'SCHEDULED',
        scheduledAt,
      },
    });
  }

  /**
   * Update campaign lead status
   */
  private async updateCampaignLeadStatus(
    campaignLeadId: string,
    status: 'PENDING' | 'SENT' | 'FAILED' | 'BOUNCED' | 'OPENED' | 'CLICKED' | 'REPLIED' | 'UNSUBSCRIBED',
    errorMessage?: string
  ): Promise<void> {
    const updateData: any = {
      status,
      ...(status === 'SENT' && { sentAt: new Date() }),
      ...(errorMessage && { errorMessage }),
    };

    await prisma.emailCampaignLead.update({
      where: { id: campaignLeadId },
      data: updateData,
    });
  }

  /**
   * Process scheduled campaigns
   */
  async processScheduledCampaigns(): Promise<void> {
    const scheduledCampaigns = await prisma.emailCampaign.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledAt: {
          lte: new Date(),
        },
      },
    });

    for (const campaign of scheduledCampaigns) {
      try {
        await this.sendCampaign(campaign.id);
      } catch (error) {
        logError(error, { context: 'Error processing scheduled campaign', campaignId: campaign.id });
        await prisma.emailCampaign.update({
          where: { id: campaign.id },
          data: { status: 'FAILED' as any },
        });
      }
    }
  }
}
