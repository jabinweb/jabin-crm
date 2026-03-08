import { prisma } from '@/lib/prisma';
import type { CashEntryType } from '@prisma/client';

export interface CreateCashEntryInput {
  technicianId: string;
  ticketId?: string;
  entryType: CashEntryType;
  amount: number;
  currency?: string;
  description: string;
  referenceNo?: string;
  recordedAt?: Date;
}

export class CashService {
  async createEntry(userId: string, input: CreateCashEntryInput) {
    return prisma.cashOnHandEntry.create({
      data: {
        userId,
        technicianId: input.technicianId,
        ticketId: input.ticketId,
        entryType: input.entryType,
        amount: input.amount,
        currency: input.currency || 'USD',
        description: input.description,
        referenceNo: input.referenceNo,
        recordedAt: input.recordedAt || new Date(),
      },
      include: {
        technician: {
          select: { id: true, name: true, email: true },
        },
        ticket: {
          select: { id: true, subject: true, status: true },
        },
      },
    });
  }

  async listEntries(
    userId: string,
    filters?: {
      technicianId?: string;
      ticketId?: string;
      entryType?: CashEntryType;
      startDate?: Date;
      endDate?: Date;
    }
  ) {
    const where: any = { userId };
    if (filters?.technicianId) where.technicianId = filters.technicianId;
    if (filters?.ticketId) where.ticketId = filters.ticketId;
    if (filters?.entryType) where.entryType = filters.entryType;
    if (filters?.startDate || filters?.endDate) {
      where.recordedAt = {};
      if (filters.startDate) where.recordedAt.gte = filters.startDate;
      if (filters.endDate) where.recordedAt.lte = filters.endDate;
    }

    return prisma.cashOnHandEntry.findMany({
      where,
      include: {
        technician: {
          select: { id: true, name: true, email: true },
        },
        ticket: {
          select: { id: true, subject: true, status: true },
        },
      },
      orderBy: { recordedAt: 'desc' },
    });
  }

  async getTechnicianBalances(userId: string) {
    const entries = await prisma.cashOnHandEntry.findMany({
      where: { userId },
      select: {
        technicianId: true,
        entryType: true,
        amount: true,
        technician: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    const balances = new Map<
      string,
      { technician: { id: string; name: string | null; email: string }; balance: number; totalAdvance: number; totalSpent: number }
    >();

    for (const entry of entries) {
      const existing = balances.get(entry.technicianId) || {
        technician: entry.technician,
        balance: 0,
        totalAdvance: 0,
        totalSpent: 0,
      };

      if (entry.entryType === 'ADVANCE') {
        existing.balance += entry.amount;
        existing.totalAdvance += entry.amount;
      } else if (entry.entryType === 'EXPENSE') {
        existing.balance -= entry.amount;
        existing.totalSpent += entry.amount;
      } else if (entry.entryType === 'SETTLEMENT') {
        existing.balance -= entry.amount;
      } else {
        existing.balance += entry.amount;
      }

      balances.set(entry.technicianId, existing);
    }

    return Array.from(balances.values()).sort((a, b) => b.balance - a.balance);
  }
}

export const cashService = new CashService();
