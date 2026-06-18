import { z } from 'zod';
import { validateRequest } from '@/lib/validations/server';
import { expenseService } from '@/lib/crm/expense-service';
import { ensureFeatureEnabled } from '@/lib/feature-modules';
import { withSessionRoute, jsonOk } from '@/lib/api/with-route';

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

export const POST = withSessionRoute(async (req, { userId }) => {
  await ensureFeatureEnabled(userId, 'SERVICE_EXPENSES');
  const body = await validateRequest(req, createExpenseSchema);

  const expense = await expenseService.createExpense(userId, {
    ...body,
    expenseDate: body.expenseDate ? new Date(body.expenseDate) : undefined,
  });

  return jsonOk(expense, { status: 201 });
});

export const GET = withSessionRoute(async (req, { userId }) => {
  await ensureFeatureEnabled(userId, 'SERVICE_EXPENSES');
  const { searchParams } = req.nextUrl;

  const expenses = await expenseService.listExpenses(userId, {
    technicianId: searchParams.get('technicianId') || undefined,
    ticketId: searchParams.get('ticketId') || undefined,
    category: (searchParams.get('category') as any) || undefined,
    status: (searchParams.get('status') as any) || undefined,
    startDate: searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : undefined,
    endDate: searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : undefined,
  });

  return jsonOk(expenses);
});
