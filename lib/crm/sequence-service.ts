import { prisma } from '@/lib/prisma';

export interface CreateSequenceData {
  name: string;
  description?: string;
  steps: {
    name: string;
    delayDays: number;
    delayHours?: number;
    subject: string;
    body: string;
    condition?: 'NO_REPLY' | 'NO_OPEN' | 'ALWAYS' | 'CLICKED' | 'REPLIED';
  }[];
}

export class EmailSequenceService {
  /**
   * Create a new email sequence
   */
  async createSequence(userId: string, data: CreateSequenceData) {
    const sequence = await prisma.emailSequence.create({
      data: {
        userId,
        name: data.name,
        description: data.description,
        steps: {
          create: data.steps.map((step, index) => ({
            stepNumber: index + 1,
            name: step.name,
            delayDays: step.delayDays,
            delayHours: step.delayHours || 0,
            subject: step.subject,
            body: step.body,
            condition: step.condition || 'ALWAYS',
          })),
        },
      },
      include: {
        steps: {
          orderBy: { stepNumber: 'asc' },
        },
      },
    });

    return sequence;
  }

  /**
   * Enroll a lead in a sequence
   */
  async enrollLead(sequenceId: string, leadId: string) {
    // Check if already enrolled
    const existing = await prisma.sequenceEnrollment.findUnique({
      where: {
        sequenceId_leadId: {
          sequenceId,
          leadId,
        },
      },
    });

    if (existing) {
      if (existing.status === 'STOPPED' || existing.status === 'COMPLETED') {
        // Re-enroll
        return await prisma.sequenceEnrollment.update({
          where: { id: existing.id },
          data: {
            status: 'ACTIVE',
            currentStep: 0,
            lastStepSentAt: null,
            nextStepDue: new Date(), // Start immediately
            completedAt: null,
            stoppedReason: null,
          },
        });
      }
      return existing;
    }

    // Create new enrollment
    const enrollment = await prisma.sequenceEnrollment.create({
      data: {
        sequenceId,
        leadId,
        status: 'ACTIVE',
        currentStep: 0,
        nextStepDue: new Date(), // Start immediately
      },
    });

    return enrollment;
  }

  /**
   * Enroll multiple leads in a sequence
   */
  async enrollLeads(sequenceId: string, leadIds: string[]) {
    const results = await Promise.allSettled(
      leadIds.map((leadId) => this.enrollLead(sequenceId, leadId))
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    return { succeeded, failed, total: leadIds.length };
  }

  /**
   * Stop a lead's sequence enrollment
   */
  async stopEnrollment(enrollmentId: string, reason: string) {
    return await prisma.sequenceEnrollment.update({
      where: { id: enrollmentId },
      data: {
        status: 'STOPPED',
        stoppedReason: reason,
        completedAt: new Date(),
      },
    });
  }

  /**
   * Pause a lead's sequence enrollment
   */
  async pauseEnrollment(enrollmentId: string) {
    return await prisma.sequenceEnrollment.update({
      where: { id: enrollmentId },
      data: {
        status: 'PAUSED',
      },
    });
  }

  /**
   * Resume a paused enrollment
   */
  async resumeEnrollment(enrollmentId: string) {
    return await prisma.sequenceEnrollment.update({
      where: { id: enrollmentId },
      data: {
        status: 'ACTIVE',
      },
    });
  }

  /**
   * Get sequence with stats
   */
  async getSequenceWithStats(sequenceId: string) {
    const sequence = await prisma.emailSequence.findUnique({
      where: { id: sequenceId },
      include: {
        steps: {
          orderBy: { stepNumber: 'asc' },
        },
        enrollments: {
          include: {
            lead: {
              select: {
                id: true,
                companyName: true,
                email: true,
                status: true,
              },
            },
          },
        },
        _count: {
          select: {
            enrollments: true,
          },
        },
      },
    });

    if (!sequence) return null;

    const stats = {
      totalEnrolled: sequence._count.enrollments,
      active: sequence.enrollments.filter((e) => e.status === 'ACTIVE').length,
      completed: sequence.enrollments.filter((e) => e.status === 'COMPLETED').length,
      stopped: sequence.enrollments.filter((e) => e.status === 'STOPPED').length,
      paused: sequence.enrollments.filter((e) => e.status === 'PAUSED').length,
    };

    return { ...sequence, stats };
  }

  /**
   * Process due sequence steps (called by cron)
   */
  async processDueSteps() {
    const dueEnrollments = await prisma.sequenceEnrollment.findMany({
      where: {
        status: 'ACTIVE',
        nextStepDue: {
          lte: new Date(),
        },
      },
      include: {
        sequence: {
          include: {
            steps: {
              orderBy: { stepNumber: 'asc' },
            },
          },
        },
        lead: {
          include: {
            user: {
              include: {
                profile: true,
              },
            },
          },
        },
      },
      take: 100, // Process in batches
    });

    const results = await Promise.allSettled(
      dueEnrollments.map((enrollment) => this.processEnrollment(enrollment))
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    return { processed: dueEnrollments.length, succeeded, failed };
  }

  /**
   * Process a single enrollment
   */
  private async processEnrollment(enrollment: any) {
    const nextStepNumber = enrollment.currentStep + 1;
    const nextStep = enrollment.sequence.steps.find(
      (s: any) => s.stepNumber === nextStepNumber
    );

    if (!nextStep) {
      // Sequence completed
      await prisma.sequenceEnrollment.update({
        where: { id: enrollment.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });
      return { status: 'completed', enrollmentId: enrollment.id };
    }

    // Check condition
    const shouldSend = await this.checkCondition(enrollment.leadId, nextStep.condition);

    if (!shouldSend) {
      // Skip this step, move to next
      const stepAfterNext = enrollment.sequence.steps.find(
        (s: any) => s.stepNumber === nextStepNumber + 1
      );

      if (!stepAfterNext) {
        // No more steps, complete
        await prisma.sequenceEnrollment.update({
          where: { id: enrollment.id },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
          },
        });
        return { status: 'completed', enrollmentId: enrollment.id };
      }

      // Schedule next step
      const nextDue = new Date();
      nextDue.setDate(nextDue.getDate() + stepAfterNext.delayDays);
      nextDue.setHours(nextDue.getHours() + stepAfterNext.delayHours);

      await prisma.sequenceEnrollment.update({
        where: { id: enrollment.id },
        data: {
          currentStep: nextStepNumber,
          nextStepDue: nextDue,
        },
      });

      return { status: 'skipped', enrollmentId: enrollment.id };
    }

    // Replace variables in email
    const subject = this.replaceVariables(nextStep.subject, enrollment.lead);
    const body = this.replaceVariables(nextStep.body, enrollment.lead);

    // Add to email queue
    const scheduledFor = new Date();
    await prisma.emailQueue.create({
      data: {
        userId: enrollment.lead.userId,
        leadId: enrollment.leadId,
        sequenceId: enrollment.sequenceId,
        priority: 3, // Medium priority
        to: enrollment.lead.email || '',
        subject,
        body,
        scheduledFor,
        status: 'PENDING',
      },
    });

    // Calculate next step due date
    const nextStepAfter = enrollment.sequence.steps.find(
      (s: any) => s.stepNumber === nextStepNumber + 1
    );

    let nextDue: Date | null = null;
    if (nextStepAfter) {
      nextDue = new Date();
      nextDue.setDate(nextDue.getDate() + nextStepAfter.delayDays);
      nextDue.setHours(nextDue.getHours() + nextStepAfter.delayHours);
    }

    // Update enrollment
    await prisma.sequenceEnrollment.update({
      where: { id: enrollment.id },
      data: {
        currentStep: nextStepNumber,
        lastStepSentAt: new Date(),
        nextStepDue: nextDue,
        status: nextDue ? 'ACTIVE' : 'COMPLETED',
        completedAt: nextDue ? null : new Date(),
      },
    });

    return { status: 'sent', enrollmentId: enrollment.id };
  }

  /**
   * Check if condition is met for sending next step
   */
  private async checkCondition(leadId: string, condition: string | null): Promise<boolean> {
    if (!condition || condition === 'ALWAYS') {
      return true;
    }

    const recentEmail = await prisma.emailLog.findFirst({
      where: { leadId },
      orderBy: { sentAt: 'desc' },
    });

    if (!recentEmail) return true;

    switch (condition) {
      case 'NO_REPLY':
        return !recentEmail.repliedAt;

      case 'NO_OPEN':
        return !recentEmail.openedAt;

      case 'CLICKED':
        return !!recentEmail.clickedAt;

      case 'REPLIED':
        return !!recentEmail.repliedAt;

      default:
        return true;
    }
  }

  /**
   * Replace template variables
   */
  private replaceVariables(template: string, lead: any): string {
    let result = template;

    const variables: Record<string, string> = {
      companyName: lead.companyName || '',
      contactName: lead.contactName || '',
      email: lead.email || '',
      phone: lead.phone || '',
      website: lead.website || '',
      industry: lead.industry || '',
      address: lead.address || '',
      city: lead.city || '',
      state: lead.state || '',
      country: lead.country || '',
    };

    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      result = result.replace(regex, value);
    }

    return result;
  }

  /**
   * Get all sequences for a user
   */
  async getUserSequences(userId: string) {
    return await prisma.emailSequence.findMany({
      where: { userId },
      include: {
        steps: {
          orderBy: { stepNumber: 'asc' },
        },
        _count: {
          select: {
            enrollments: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Delete a sequence
   */
  async deleteSequence(sequenceId: string) {
    return await prisma.emailSequence.delete({
      where: { id: sequenceId },
    });
  }

  /**
   * Update sequence
   */
  async updateSequence(sequenceId: string, data: Partial<CreateSequenceData>) {
    const updateData: any = {
      name: data.name,
      description: data.description,
    };

    if (data.steps) {
      // Delete existing steps
      await prisma.sequenceStep.deleteMany({
        where: { sequenceId },
      });

      // Create new steps
      updateData.steps = {
        create: data.steps.map((step, index) => ({
          stepNumber: index + 1,
          name: step.name,
          delayDays: step.delayDays,
          delayHours: step.delayHours || 0,
          subject: step.subject,
          body: step.body,
          condition: step.condition || 'ALWAYS',
        })),
      };
    }

    return await prisma.emailSequence.update({
      where: { id: sequenceId },
      data: updateData,
      include: {
        steps: {
          orderBy: { stepNumber: 'asc' },
        },
      },
    });
  }
}

export const sequenceService = new EmailSequenceService();
