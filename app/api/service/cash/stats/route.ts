import { cashService } from '@/lib/crm/cash-service';
import { ensureFeatureEnabled } from '@/lib/feature-modules';
import { withSessionRoute, jsonOk } from '@/lib/api/with-route';

export const GET = withSessionRoute(async (_req, { userId }) => {
  await ensureFeatureEnabled(userId, 'SERVICE_CASH');
  const balances = await cashService.getTechnicianBalances(userId);
  return jsonOk({ balances });
});
