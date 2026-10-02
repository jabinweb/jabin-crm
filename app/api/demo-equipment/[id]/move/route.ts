import { NextResponse } from 'next/server';
import { checkOpsAccess, SALES_DOC_ROLES } from '@/lib/crm/ops-access';
import { withStaffRoute, jsonOk } from '@/lib/api/with-route';
import { moveDemoUnit } from '@/lib/crm/demo-equipment';
import { validateDemoUnitRefs } from '../../_validate-refs';
import type { DemoMovementType } from '@prisma/client';

const TYPES: DemoMovementType[] = [
  'CHECKOUT',
  'TRANSFER',
  'RETURN',
  'RELOCATE',
  'MAINTENANCE',
  'RETIRE',
];

export const POST = withStaffRoute(async (request, { session, companyId, userId }, routeContext) => {
  // Demo fleet (Ops → Installed equipment): sales-document roles with the Equipment module
  const denied = await checkOpsAccess(session, companyId, { roles: SALES_DOC_ROLES, module: 'EQUIPMENT' });
  if (denied) return denied;
  if (!companyId) {
    return NextResponse.json({ error: 'Company context required' }, { status: 400 });
  }
  const { id } = await routeContext!.params;
  const body = await request.json();
  if (!body.type || !TYPES.includes(body.type)) {
    return NextResponse.json(
      { error: `type must be one of: ${TYPES.join(', ')}` },
      { status: 400 }
    );
  }

  const refError = await validateDemoUnitRefs(companyId, {
    locationId: body.toLocationId,
    customerId: body.toCustomerId,
    custodianUserId: body.toCustodianId,
  });
  if (refError) {
    return NextResponse.json({ error: refError }, { status: 400 });
  }

  const result = await moveDemoUnit(
    companyId,
    id,
    {
      type: body.type,
      toLocationId: body.toLocationId,
      toCustomerId: body.toCustomerId,
      toCustodianId: body.toCustodianId,
      purpose: body.purpose,
      notes: body.notes,
      expectedReturnAt: body.expectedReturnAt,
      status: body.status,
    },
    userId
  );

  if (!result) {
    return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
  }
  return jsonOk(result);
});
