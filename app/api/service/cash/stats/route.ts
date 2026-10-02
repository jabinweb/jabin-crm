import { cashService } from '@/lib/crm/cash-service';
import { ensureFeatureEnabled } from '@/lib/feature-modules';
import { withApiRoute, jsonOk } from '@/lib/api/with-route';

export const GET = withApiRoute({ auth: 'tenant-optional', handler: async (_req, { userId, companyId }) => {
  await ensureFeatureEnabled(userId, 'SERVICE_CASH');
  const balances = await cashService.getTechnicianBalances(userId, companyId);
  return jsonOk({ balances });
} });
