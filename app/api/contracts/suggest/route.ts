import { NextResponse } from 'next/server';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';
import { suggestContractsForTicket } from '@/lib/crm/service-contract-service';

/** GET /api/contracts/suggest?customerId=&equipmentId= — active contracts for ticket linking */
export const GET = withTenantRoute(async (req, { companyId }) => {
  const customerId = req.nextUrl.searchParams.get('customerId');
  if (!customerId) {
    return NextResponse.json({ error: 'customerId required' }, { status: 400 });
  }
  const equipmentId = req.nextUrl.searchParams.get('equipmentId');
  const contracts = await suggestContractsForTicket(
    companyId,
    customerId,
    equipmentId || null
  );
  return jsonOk({ contracts });
});
