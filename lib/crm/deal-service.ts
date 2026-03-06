import { prisma } from '@/lib/prisma';

export interface CreateDealData {
  leadId: string;
  title: string;
  value: number;
  currency?: string;
  stage?: 'PROSPECTING' | 'QUALIFICATION' | 'PROPOSAL' | 'NEGOTIATION' | 'CLOSED_WON' | 'CLOSED_LOST';
  probability?: number;
  expectedCloseDate?: Date;
  notes?: string;
}

export class DealService {
  /**
   * Create a new deal
   */
  async createDeal(userId: string, data: CreateDealData) {
    const deal = await prisma.deal.create({
      data: {
        userId,
        leadId: data.leadId,
        title: data.title,
        value: data.value,
        currency: data.currency || 'USD',
        stage: data.stage || 'PROSPECTING',
        probability: data.probability || 50,
        expectedCloseDate: data.expectedCloseDate,
        notes: data.notes,
      },
      include: {
        lead: {
          select: {
            id: true,
            companyName: true,
            email: true,
            contactName: true,
          },
        },
        tasks: {
          where: {
            status: {
              not: 'COMPLETED',
            },
          },
        },
      },
    });

    // Create activity on lead
    await prisma.leadActivity.create({
      data: {
        leadId: data.leadId,
        userId,
        activityType: 'CREATED',
        description: `Deal created: ${data.title} ($${data.value})`,
      },
    });

    return deal;
  }

  /**
   * Get all deals for a user
   */
  async getUserDeals(userId: string, filters?: {
    stage?: string;
    minValue?: number;
    maxValue?: number;
  }) {
    const where: any = { userId };

    if (filters?.stage) where.stage = filters.stage;
    if (filters?.minValue) where.value = { ...where.value, gte: filters.minValue };
    if (filters?.maxValue) where.value = { ...where.value, lte: filters.maxValue };

    return await prisma.deal.findMany({
      where,
      include: {
        lead: {
          select: {
            id: true,
            companyName: true,
            email: true,
            contactName: true,
            phone: true,
          },
        },
        tasks: {
          where: {
            status: {
              not: 'COMPLETED',
            },
          },
          orderBy: {
            dueDate: 'asc',
          },
        },
        _count: {
          select: {
            tasks: true,
          },
        },
      },
      orderBy: [
        { stage: 'asc' },
        { expectedCloseDate: 'asc' },
      ],
    });
  }

  /**
   * Update deal
   */
  async updateDeal(dealId: string, data: Partial<CreateDealData>) {
    const updateData: any = {};

    if (data.title) updateData.title = data.title;
    if (data.value !== undefined) updateData.value = data.value;
    if (data.currency) updateData.currency = data.currency;
    if (data.stage) {
      updateData.stage = data.stage;

      // Auto-update close date if won/lost
      if (data.stage === 'CLOSED_WON' || data.stage === 'CLOSED_LOST') {
        updateData.actualCloseDate = new Date();
      }

      // Update lead status
      if (data.stage === 'CLOSED_WON') {
        const deal = await prisma.deal.findUnique({
          where: { id: dealId },
          select: { leadId: true },
        });

        if (deal) {
          await prisma.lead.update({
            where: { id: deal.leadId },
            data: { status: 'CONVERTED' },
          });
        }
      }
    }
    if (data.probability !== undefined) updateData.probability = data.probability;
    if (data.expectedCloseDate !== undefined) updateData.expectedCloseDate = data.expectedCloseDate;
    if (data.notes !== undefined) updateData.notes = data.notes;

    return await prisma.deal.update({
      where: { id: dealId },
      data: updateData,
      include: {
        lead: {
          select: {
            id: true,
            companyName: true,
            email: true,
            contactName: true,
          },
        },
        tasks: true,
      },
    });
  }

  /**
   * Move deal to next stage
   */
  async moveToNextStage(dealId: string) {
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      select: { stage: true, probability: true },
    });

    if (!deal) throw new Error('Deal not found');

    const stageFlow: Record<string, { next: string; probability: number }> = {
      PROSPECTING: { next: 'QUALIFICATION', probability: 25 },
      QUALIFICATION: { next: 'PROPOSAL', probability: 50 },
      PROPOSAL: { next: 'NEGOTIATION', probability: 75 },
      NEGOTIATION: { next: 'CLOSED_WON', probability: 90 },
    };

    const nextStage = stageFlow[deal.stage];
    if (!nextStage) throw new Error('Cannot move from this stage');

    return await this.updateDeal(dealId, {
      stage: nextStage.next as any,
      probability: nextStage.probability,
    });
  }

  /**
   * Mark deal as won
   */
  async markAsWon(dealId: string) {
    return await this.updateDeal(dealId, {
      stage: 'CLOSED_WON',
      probability: 100,
    });
  }

  /**
   * Mark deal as lost
   */
  async markAsLost(dealId: string, reason: string) {
    const deal = await prisma.deal.update({
      where: { id: dealId },
      data: {
        stage: 'CLOSED_LOST',
        probability: 0,
        lostReason: reason,
        actualCloseDate: new Date(),
      },
      include: {
        lead: true,
      },
    });

    // Update lead status
    await prisma.lead.update({
      where: { id: deal.leadId },
      data: { status: 'LOST' },
    });

    return deal;
  }

  /**
   * Get deal pipeline stats
   */
  async getPipelineStats(userId: string) {
    const deals = await prisma.deal.findMany({
      where: { userId },
      select: {
        stage: true,
        value: true,
        probability: true,
      },
    });

    const stagesList = [
      'PROSPECTING',
      'QUALIFICATION',
      'PROPOSAL',
      'NEGOTIATION',
      'CLOSED_WON',
      'CLOSED_LOST',
    ];

    const stages = stagesList.map((stage) => {
      const stageDeals = deals.filter((d) => d.stage === stage);

      return {
        stage,
        count: stageDeals.length,
        totalValue: stageDeals.reduce((sum, d) => sum + d.value, 0),
      };
    });

    const totalValue = deals.reduce((sum, d) => sum + d.value, 0);

    const weightedValue = deals
      .filter((d) => !d.stage.includes('CLOSED'))
      .reduce((sum, d) => sum + d.value * (d.probability / 100), 0);

    return {
      stages,
      totalValue,
      weightedValue,
    };
  }

  /**
   * Get revenue forecast
   */
  async getRevenueForecast(userId: string, months: number = 3) {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + months);

    const deals = await prisma.deal.findMany({
      where: {
        userId,
        expectedCloseDate: {
          gte: startDate,
          lte: endDate,
        },
        stage: {
          notIn: ['CLOSED_WON', 'CLOSED_LOST'],
        },
      },
      select: {
        value: true,
        probability: true,
        expectedCloseDate: true,
      },
    });

    const forecast = {
      best: deals.reduce((sum, d) => sum + d.value, 0),
      likely: deals.reduce((sum, d) => sum + d.value * (d.probability / 100), 0),
      worst: deals.filter((d) => d.probability >= 75).reduce((sum, d) => sum + d.value * 0.5, 0),
    };

    return forecast;
  }

  /**
   * Get win/loss analysis
   */
  async getWinLossAnalysis(userId: string, days: number = 90) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const closedDeals = await prisma.deal.findMany({
      where: {
        userId,
        actualCloseDate: {
          gte: since,
        },
        stage: {
          in: ['CLOSED_WON', 'CLOSED_LOST'],
        },
      },
      select: {
        stage: true,
        value: true,
        lostReason: true,
      },
    });

    const won = closedDeals.filter((d) => d.stage === 'CLOSED_WON');
    const lost = closedDeals.filter((d) => d.stage === 'CLOSED_LOST');

    const lostReasons: Record<string, number> = {};
    lost.forEach((d) => {
      const reason = d.lostReason || 'Unknown';
      lostReasons[reason] = (lostReasons[reason] || 0) + 1;
    });

    return {
      totalClosed: closedDeals.length,
      won: won.length,
      lost: lost.length,
      winRate: closedDeals.length > 0 ? (won.length / closedDeals.length) * 100 : 0,
      wonValue: won.reduce((sum, d) => sum + d.value, 0),
      lostValue: lost.reduce((sum, d) => sum + d.value, 0),
      lostReasons,
    };
  }

  /**
   * Delete a deal
   */
  async deleteDeal(dealId: string) {
    return await prisma.deal.delete({
      where: { id: dealId },
    });
  }
}

export const dealService = new DealService();
