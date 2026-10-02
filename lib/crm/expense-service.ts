import { workspaceStaffWhere } from '@/lib/auth/workspace-staff';
import { prisma } from '@/lib/prisma';
import type { ExpenseStatus, Prisma, TravelExpenseCategory } from '@prisma/client';

export interface CreateExpenseInput {
  technicianId: string;
  ticketId?: string;
  category: TravelExpenseCategory;
  amount: number;
  currency?: string;
  distanceKm?: number;
  fromLocation?: string;
  toLocation?: string;
  description: string;
  expenseDate?: Date;
  receiptUrl?: string;
}

/**
 * Which expenses a user may see. Managers (`viewAll`) see every expense for technicians
 * of the workspace; everyone else sees expenses they recorded or that were filed for them.
 */
function expenseVisibilityWhere(
  userId: string,
  companyId?: string,
  viewAll?: boolean
): Prisma.TravelExpenseWhereInput {
  const inWorkspace = companyId ? { technician: workspaceStaffWhere(companyId) } : {};
  if (viewAll && companyId) return inWorkspace;
  return { ...inWorkspace, OR: [{ userId }, { technicianId: userId }] };
}

export class ExpenseService {
  async createExpense(userId: string, input: CreateExpenseInput) {
    return prisma.travelExpense.create({
      data: {
        userId,
        technicianId: input.technicianId,
        ticketId: input.ticketId,
        category: input.category,
        amount: input.amount,
        currency: input.currency || 'USD',
        distanceKm: input.distanceKm,
        fromLocation: input.fromLocation,
        toLocation: input.toLocation,
        description: input.description,
        expenseDate: input.expenseDate || new Date(),
        receiptUrl: input.receiptUrl,
      },
      include: {
        technician: {
          select: { id: true, name: true, email: true },
        },
        approver: {
          select: { id: true, name: true, email: true },
        },
        ticket: {
          select: { id: true, subject: true, status: true },
        },
      },
    });
  }

  async listExpenses(
    userId: string,
    filters?: {
      technicianId?: string;
      ticketId?: string;
      category?: TravelExpenseCategory;
      status?: ExpenseStatus;
      startDate?: Date;
      endDate?: Date;
      /** Limit to technicians of this workspace (creator may belong to several). */
      companyId?: string;
      /** Managers see every expense in the workspace; others only their own. */
      viewAll?: boolean;
    }
  ) {
    const where: Prisma.TravelExpenseWhereInput = expenseVisibilityWhere(
      userId,
      filters?.companyId,
      filters?.viewAll
    );
    if (filters?.technicianId) where.technicianId = filters.technicianId;
    if (filters?.ticketId) where.ticketId = filters.ticketId;
    if (filters?.category) where.category = filters.category;
    if (filters?.status) where.status = filters.status;
    if (filters?.startDate || filters?.endDate) {
      where.expenseDate = {};
      if (filters.startDate) where.expenseDate.gte = filters.startDate;
      if (filters.endDate) where.expenseDate.lte = filters.endDate;
    }

    return prisma.travelExpense.findMany({
      where,
      include: {
        technician: {
          select: { id: true, name: true, email: true },
        },
        approver: {
          select: { id: true, name: true, email: true },
        },
        ticket: {
          select: { id: true, subject: true, status: true },
        },
      },
      orderBy: { expenseDate: 'desc' },
    });
  }

  async updateExpenseStatus(
    expenseId: string,
    status: ExpenseStatus,
    approvedById?: string,
    rejectionReason?: string
  ) {
    const data: Prisma.TravelExpenseUpdateInput = { status };

    if (status === 'APPROVED' || status === 'REIMBURSED') {
      if (approvedById) {
        data.approver = { connect: { id: approvedById } };
      }
      data.approvedAt = new Date();
      data.rejectionReason = null;
    }

    if (status === 'REJECTED') {
      if (approvedById) {
        data.approver = { connect: { id: approvedById } };
      }
      data.approvedAt = new Date();
      data.rejectionReason = rejectionReason || 'No reason provided';
    }

    return prisma.travelExpense.update({
      where: { id: expenseId },
      data,
      include: {
        technician: {
          select: { id: true, name: true, email: true },
        },
        approver: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }

  async getExpenseStats(userId: string, companyId?: string, viewAll?: boolean) {
    const expenses = await prisma.travelExpense.findMany({
      where: expenseVisibilityWhere(userId, companyId, viewAll),
      select: {
        status: true,
        amount: true,
        category: true,
      },
    });
    type ExpenseStatRow = (typeof expenses)[number];

    return {
      totalCount: expenses.length,
      totalAmount: expenses.reduce((sum: number, e: ExpenseStatRow) => sum + e.amount, 0),
      pendingCount: expenses.filter((e: ExpenseStatRow) => e.status === 'PENDING').length,
      approvedAmount: expenses
        .filter((e: ExpenseStatRow) => e.status === 'APPROVED' || e.status === 'REIMBURSED')
        .reduce((sum: number, e: ExpenseStatRow) => sum + e.amount, 0),
      byCategory: Object.entries(
        expenses.reduce((acc: Record<string, number>, e: ExpenseStatRow) => {
          acc[e.category] = (acc[e.category] || 0) + e.amount;
          return acc;
        }, {} as Record<string, number>)
      ).map(([category, amount]) => ({ category, amount })),
    };
  }
}

export const expenseService = new ExpenseService();
