import { z } from 'zod';
import { validateRequest } from '@/lib/validations/server';
import { expenseService } from '@/lib/crm/expense-service';
import { ensureFeatureEnabled } from '@/lib/feature-modules';
import { withSessionRoute, jsonOk } from '@/lib/api/with-route';

const updateStatusSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'REIMBURSED']),
  rejectionReason: z.string().optional(),
});

export const PATCH = withSessionRoute(async (req, { userId }, routeContext) => {
  await ensureFeatureEnabled(userId, 'SERVICE_EXPENSES');
  const { id } = await routeContext!.params;
  const body = await validateRequest(req, updateStatusSchema);

  const expense = await expenseService.updateExpenseStatus(
    id,
    body.status,
    userId,
    body.rejectionReason
  );

  return jsonOk(expense);
});
