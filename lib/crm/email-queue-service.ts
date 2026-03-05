import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email/nodemailer';
import { getUserSmtpConfig } from '@/lib/smtp-config';
import { unsubscribeService } from './unsubscribe-service';
import { addEmailTracking } from '@/lib/email/tracking';
import { logError } from '@/lib/logger';

export interface QueueEmailData {
  userId: string;
  leadId?: string;
  campaignId?: string;
  sequenceId?: string;
  to: string;
  subject: string;
  body: string;
  scheduledFor?: Date;
  priority?: number; // 1-10 (1=highest)
}

export class EmailQueueService {
  private readonly DEFAULT_RATE_LIMIT = 50; // emails per hour
  private readonly DEFAULT_PRIORITY = 5;

  /**
   * Add email to queue
   */
  async queueEmail(data: QueueEmailData) {
    const scheduledFor = data.scheduledFor || new Date();

    const queueItem = await prisma.emailQueue.create({
      data: {
        userId: data.userId,
        leadId: data.leadId,
        campaignId: data.campaignId,
        sequenceId: data.sequenceId,
        to: data.to,
        subject: data.subject,
        body: data.body,
        scheduledFor,
        priority: data.priority || this.DEFAULT_PRIORITY,
        status: 'PENDING',
      },
    });

    return queueItem;
  }

  /**
   * Process email queue (called by cron)
   */
  async processQueue() {
    // Get user rate limits (emails sent in last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const recentSends = await prisma.emailQueue.groupBy({
      by: ['userId'],
      where: {
        status: 'SENT',
        sentAt: {
          gte: oneHourAgo,
        },
      },
      _count: {
        userId: true,
      },
    });

    const userSendCounts = new Map(
      recentSends.map((r) => [r.userId, r._count.userId])
    );

    // Get pending emails
    const pendingEmails = await prisma.emailQueue.findMany({
      where: {
        status: 'PENDING',
        scheduledFor: {
          lte: new Date(),
        },
        attempts: {
          lt: 3, // Max 3 attempts
        },
      },
      orderBy: [
        { priority: 'asc' }, // Lower number = higher priority
        { scheduledFor: 'asc' },
      ],
      take: 100, // Process in batches
    });

    const results = {
      processed: 0,
      sent: 0,
      failed: 0,
      rateLimited: 0,
    };

    for (const email of pendingEmails) {
      const userId = email.userId;
      const sendCount = userSendCounts.get(userId) || 0;

      // Check rate limit
      if (sendCount >= this.DEFAULT_RATE_LIMIT) {
        results.rateLimited++;
        // Reschedule for later
        await prisma.emailQueue.update({
          where: { id: email.id },
          data: {
            scheduledFor: new Date(Date.now() + 60 * 60 * 1000), // 1 hour later
          },
        });
        continue;
      }

      // Check if email is in unsubscribe list
      const isUnsubscribed = await unsubscribeService.isUnsubscribed(email.to);

      if (isUnsubscribed) {
        await prisma.emailQueue.update({
          where: { id: email.id },
          data: {
            status: 'CANCELLED',
            errorMessage: 'Email is in unsubscribe list',
          },
        });

        // Stop sequence enrollment if exists
        if (email.sequenceId && email.leadId) {
          await prisma.sequenceEnrollment.updateMany({
            where: {
              sequenceId: email.sequenceId,
              leadId: email.leadId,
            },
            data: {
              status: 'STOPPED',
              stoppedReason: 'Email unsubscribed',
            },
          });
        }

        results.processed++;
        continue;
      }

      // Send email
      try {
        await this.sendQueuedEmail(email);

        // Update send count
        userSendCounts.set(userId, sendCount + 1);

        results.sent++;
      } catch (error) {
        logError(error, { context: 'Failed to send queued email', emailId: email.id });
        results.failed++;
      }

      results.processed++;
    }

    return results;
  }

  /**
   * Send a queued email
   */
  private async sendQueuedEmail(queueItem: any) {
    try {
      // Update status to sending
      await prisma.emailQueue.update({
        where: { id: queueItem.id },
        data: {
          status: 'SENDING',
          attempts: {
            increment: 1,
          },
        },
      });

      // Get SMTP config
      const smtpConfig = await getUserSmtpConfig(queueItem.userId);
      if (!smtpConfig) {
        throw new Error('SMTP configuration not found');
      }

      // Create email log first
      const emailLog = await prisma.emailLog.create({
        data: {
          userId: queueItem.userId,
          leadId: queueItem.leadId,
          campaignId: queueItem.campaignId,
          to: queueItem.to,
          subject: queueItem.subject,
          body: queueItem.body,
          status: 'PENDING',
        },
      });

      // Generate unsubscribe link
      const unsubscribeToken = Buffer.from(queueItem.to).toString('base64');
      const unsubscribeLink = `${process.env.AUTH_URL}/unsubscribe/${unsubscribeToken}`;

      // Add unsubscribe footer
      const unsubscribeHtml = `<p style="font-size: 12px; color: #999; margin-top: 40px;">
        <a href="${unsubscribeLink}" style="color: #999; text-decoration: underline;">Unsubscribe</a>
      </p>`;

      const bodyWithFooter = queueItem.body + unsubscribeHtml;

      // Add email tracking (pixel + link wrapping)
      const baseUrl = process.env.AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const bodyWithTracking = addEmailTracking(bodyWithFooter, emailLog.id, baseUrl);

      // Send email
      const result = await sendEmail({
        to: queueItem.to,
        subject: queueItem.subject,
        html: bodyWithTracking,
        from: smtpConfig.from || smtpConfig.user,
        smtpConfig,
      });

      // Update queue item
      await prisma.emailQueue.update({
        where: { id: queueItem.id },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          messageId: result.messageId || emailLog.id,
        },
      });

      // Update email log
      await prisma.emailLog.update({
        where: { id: emailLog.id },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          messageId: result.messageId || emailLog.id,
        },
      });

      // Update lead last contacted
      if (queueItem.leadId) {
        await prisma.lead.update({
          where: { id: queueItem.leadId },
          data: { lastContactedAt: new Date() },
        });

        // Create activity
        await prisma.leadActivity.create({
          data: {
            leadId: queueItem.leadId,
            userId: queueItem.userId,
            activityType: 'EMAIL_SENT',
            description: `Email sent: ${queueItem.subject}`,
          },
        });
      }

      return result;
    } catch (error: any) {
      // Update queue item with error
      await prisma.emailQueue.update({
        where: { id: queueItem.id },
        data: {
          status: queueItem.attempts >= 2 ? 'FAILED' : 'PENDING',
          errorMessage: error.message,
        },
      });

      throw error;
    }
  }

  /**
   * Get queue stats for a user
   */
  async getQueueStats(userId: string) {
    const stats = await prisma.emailQueue.groupBy({
      by: ['status'],
      where: { userId },
      _count: {
        status: true,
      },
    });

    const pending = stats.find((s) => s.status === 'PENDING')?._count.status || 0;
    const sending = stats.find((s) => s.status === 'SENDING')?._count.status || 0;
    const sent = stats.find((s) => s.status === 'SENT')?._count.status || 0;
    const failed = stats.find((s) => s.status === 'FAILED')?._count.status || 0;

    return { pending, sending, sent, failed };
  }

  /**
   * Retry failed emails
   */
  async retryFailed(userId: string) {
    const updated = await prisma.emailQueue.updateMany({
      where: {
        userId,
        status: 'FAILED',
        attempts: {
          lt: 3,
        },
      },
      data: {
        status: 'PENDING',
        scheduledFor: new Date(),
      },
    });

    return { retriedCount: updated.count };
  }

  /**
   * Cancel pending emails
   */
  async cancelPending(userId: string, filters?: { leadId?: string; campaignId?: string; sequenceId?: string }) {
    const where: any = {
      userId,
      status: 'PENDING',
    };

    if (filters?.leadId) where.leadId = filters.leadId;
    if (filters?.campaignId) where.campaignId = filters.campaignId;
    if (filters?.sequenceId) where.sequenceId = filters.sequenceId;

    const updated = await prisma.emailQueue.updateMany({
      where,
      data: {
        status: 'CANCELLED',
      },
    });

    return { cancelledCount: updated.count };
  }
}

export const emailQueueService = new EmailQueueService();
