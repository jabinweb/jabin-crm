import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth-middleware';
import { validateRequest } from '@/lib/validation';
import { handleApiError } from '@/lib/api-error-handler';
import { expenseService } from '@/lib/crm/expense-service';
import { ensureFeatureEnabled } from '@/lib/feature-modules';

const updateStatusSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'REIMBURSED']),
  rejectionReason: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(req);
    await ensureFeatureEnabled(session.user.id, 'SERVICE_EXPENSES');
    const { id } = await params;
    const body = await validateRequest(req, updateStatusSchema);

    const expense = await expenseService.updateExpenseStatus(
      id,
      body.status,
      session.user.id,
      body.rejectionReason
    );

    return NextResponse.json(expense);
  } catch (error) {
    return handleApiError(error);
  }
}
