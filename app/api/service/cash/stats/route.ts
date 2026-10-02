import { cashService } from '@/lib/crm/cash-service';
import { ensureFeatureEnabled } from '@/lib/feature-modules';
import { NextResponse } from 'next/server';
import { withApiRoute, jsonOk } from '@/lib/api/with-route';
import { isFieldServiceManager, isFieldServiceUser } from '@/app/api/service/_roles';

export const GET = withApiRoute({ auth: 'tenant-optional', handler: async (_req, { session, userId, companyId }) => {
  if (!isFieldServiceUser(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  await ensureFeatureEnabled(userId, 'SERVICE_CASH', companyId);
  const balances = await cashService.getTechnicianBalances(userId, companyId, isFieldServiceManager(session));
  return jsonOk({ balances });
} });
