import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth-middleware';
import { validateRequest } from '@/lib/validation';
import { handleApiError } from '@/lib/api-error-handler';
import { expenseService } from '@/lib/crm/expense-service';
import { ensureFeatureEnabled } from '@/lib/feature-modules';

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

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    await ensureFeatureEnabled(session.user.id, 'SERVICE_EXPENSES');
    const body = await validateRequest(req, createExpenseSchema);

    const expense = await expenseService.createExpense(session.user.id, {
      ...body,
      expenseDate: body.expenseDate ? new Date(body.expenseDate) : undefined,
    });

    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    await ensureFeatureEnabled(session.user.id, 'SERVICE_EXPENSES');
    const { searchParams } = req.nextUrl;

    const expenses = await expenseService.listExpenses(session.user.id, {
      technicianId: searchParams.get('technicianId') || undefined,
      ticketId: searchParams.get('ticketId') || undefined,
      category: (searchParams.get('category') as any) || undefined,
      status: (searchParams.get('status') as any) || undefined,
      startDate: searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : undefined,
      endDate: searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : undefined,
    });

    return NextResponse.json(expenses);
  } catch (error) {
    return handleApiError(error);
  }
}
