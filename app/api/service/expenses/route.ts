import { z } from 'zod';
import { validateRequest } from '@/lib/validations/server';
import { expenseService } from '@/lib/crm/expense-service';
import { ensureFeatureEnabled } from '@/lib/feature-modules';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withSessionRoute, withTenantRoute, jsonOk, withApiRoute } from '@/lib/api/with-route';
import { isWorkspaceStaff } from '@/lib/auth/workspace-staff';
import { isFieldServiceManager, isFieldServiceUser } from '@/app/api/service/_roles';

const createExpenseSchema = z.object({
  technicianId: z.string().min(1),
  ticketId: z.string().optional(),
  category: z.enum(['TRAVEL', 'LODGING', 'MEAL', 'PARTS', 'OTHER']),
  amount: z.number().positive(),
  currency: z.string().optional(),
  distanceKm: z.number().nonnegative().optional(),
  fromLocation: z.string().optional(),
  toLocation: z.string().optional(),
  description: z.string().min(1),
  expenseDate: z.string().datetime().optional(),
  receiptUrl: z.string().optional(),
});

export const POST = withTenantRoute(async (req, { session, userId, companyId }) => {
  if (!isFieldServiceUser(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  await ensureFeatureEnabled(userId, 'SERVICE_EXPENSES', companyId);
  const body = await validateRequest(req, createExpenseSchema);

  // Technicians file their own expenses; managers can file for anyone on the team.
  if (!isFieldServiceManager(session) && body.technicianId !== userId) {
    return NextResponse.json({ error: 'You can only file your own expenses' }, { status: 403 });
  }

  if (!(await isWorkspaceStaff(companyId, body.technicianId))) {
    return NextResponse.json({ error: 'Technician not found' }, { status: 404 });
  }
  if (body.ticketId) {
    const ticket = await prisma.supportTicket.findFirst({
      where: { id: body.ticketId, customer: { companyId } },
      select: { id: true },
    });
    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }
  }

  const expense = await expenseService.createExpense(userId, {
    ...body,
    expenseDate: body.expenseDate ? new Date(body.expenseDate) : undefined,
  });

  return jsonOk(expense, { status: 201 });
});

export const GET = withApiRoute({ auth: 'tenant-optional', handler: async (req, { session, userId, companyId }) => {
  if (!isFieldServiceUser(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  await ensureFeatureEnabled(userId, 'SERVICE_EXPENSES', companyId);
  const { searchParams } = req.nextUrl;

  const expenses = await expenseService.listExpenses(userId, {
    companyId,
    // Managers review the whole team's expenses; technicians see their own.
    viewAll: isFieldServiceManager(session),
    technicianId: searchParams.get('technicianId') || undefined,
    ticketId: searchParams.get('ticketId') || undefined,
    category: (searchParams.get('category') as any) || undefined,
    status: (searchParams.get('status') as any) || undefined,
    startDate: searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : undefined,
    endDate: searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : undefined,
  });

  return jsonOk(expenses);
} });
