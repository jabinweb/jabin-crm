import { expenseService } from '@/lib/crm/expense-service';
import { ensureFeatureEnabled } from '@/lib/feature-modules';
import { withApiRoute, jsonOk } from '@/lib/api/with-route';

export const GET = withApiRoute({ auth: 'tenant-optional', handler: async (_req, { userId, companyId }) => {
  await ensureFeatureEnabled(userId, 'SERVICE_EXPENSES');
  const stats = await expenseService.getExpenseStats(userId, companyId);
  return jsonOk(stats);
} });
