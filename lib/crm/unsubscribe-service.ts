import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export class UnsubscribeService {
  /**
   * Generate unsubscribe token
   */
  generateToken(email: string): string {
    return Buffer.from(email).toString('base64url');
  }

  /**
   * Decode unsubscribe token
   */
  decodeToken(token: string): string {
    return Buffer.from(token, 'base64url').toString('utf-8');
  }

  /**
   * Add email to unsubscribe list
   */
  async unsubscribe(
    email: string,
    options?: {
      userId?: string;
      leadId?: string;
      reason?: string;
      source?: string;
    }
  ) {
    // Add to unsubscribe list
    const unsubscribe = await prisma.unsubscribeList.upsert({
      where: { email },
      create: {
        email,
        userId: options?.userId,
        leadId: options?.leadId,
        reason: options?.reason,
        source: options?.source || 'LINK_CLICK',
      },
      update: {
        unsubscribedAt: new Date(),
      },
    });

    // Update lead status if leadId provided
    if (options?.leadId) {
      await prisma.lead.update({
        where: { id: options.leadId },
        data: { status: 'UNSUBSCRIBED' },
      });

      await prisma.leadActivity.create({
        data: {
          leadId: options.leadId,
          activityType: 'STATUS_CHANGED',
          description: 'Lead unsubscribed from emails',
        },
      });
    }

    // Find and update all leads with this email
    await prisma.lead.updateMany({
      where: { email },
      data: { status: 'UNSUBSCRIBED' },
    });

    // Stop all active sequence enrollments
    const leads = await prisma.lead.findMany({
      where: { email },
      select: { id: true },
    });

    if (leads.length > 0) {
      await prisma.sequenceEnrollment.updateMany({
        where: {
          leadId: {
            in: leads.map((l) => l.id),
          },
          status: 'ACTIVE',
        },
        data: {
          status: 'STOPPED',
          stoppedReason: 'Email unsubscribed',
        },
      });
    }

    // Cancel pending emails in queue
    await prisma.emailQueue.updateMany({
      where: {
        to: email,
        status: 'PENDING',
      },
      data: {
        status: 'CANCELLED',
        errorMessage: 'Email unsubscribed',
      },
    });

    return unsubscribe;
  }

  /**
   * Check if email is unsubscribed
   */
  async isUnsubscribed(email: string): Promise<boolean> {
    const unsubscribe = await prisma.unsubscribeList.findUnique({
      where: { email },
    });

    return !!unsubscribe;
  }

  /**
   * Remove email from unsubscribe list (resubscribe)
   */
  async resubscribe(email: string) {
    await prisma.unsubscribeList.delete({
      where: { email },
    });

    // Update lead statuses back to NEW
    await prisma.lead.updateMany({
      where: {
        email,
        status: 'UNSUBSCRIBED',
      },
      data: {
        status: 'NEW',
      },
    });

    return { success: true };
  }

  /**
   * Get unsubscribe list for user
   */
  async getUnsubscribeList(userId: string) {
    return await prisma.unsubscribeList.findMany({
      where: { userId },
      orderBy: { unsubscribedAt: 'desc' },
    });
  }

  /**
   * Get all unsubscribes (admin)
   */
  async getAllUnsubscribes() {
    return await prisma.unsubscribeList.findMany({
      orderBy: { unsubscribedAt: 'desc' },
    });
  }

  /**
   * Get unsubscribe stats
   */
  async getUnsubscribeStats(userId?: string) {
    const where: any = {};
    if (userId) where.userId = userId;

    const total = await prisma.unsubscribeList.count({ where });

    const last30Days = await prisma.unsubscribeList.count({
      where: {
        ...where,
        unsubscribedAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
    });

    const bySource = await prisma.unsubscribeList.groupBy({
      by: ['source'],
      where,
      _count: {
        source: true,
      },
    });

    return {
      total,
      last30Days,
      bySource: Object.fromEntries(
        bySource.map((s) => [s.source || 'Unknown', s._count.source])
      ),
    };
  }

  /**
   * Bulk import unsubscribe list
   */
  async bulkImport(emails: string[], userId?: string) {
    const results = await Promise.allSettled(
      emails.map((email) =>
        this.unsubscribe(email, {
          userId,
          source: 'MANUAL',
          reason: 'Bulk imported',
        })
      )
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    return { total: emails.length, succeeded, failed };
  }

  /**
   * Generate unsubscribe link for email
   */
  generateUnsubscribeLink(email: string): string {
    const token = this.generateToken(email);
    return `${process.env.AUTH_URL}/unsubscribe/${token}`;
  }
}

export const unsubscribeService = new UnsubscribeService();
