import { NextResponse } from 'next/server';
import { withStaffRoute, jsonOk } from '@/lib/api/with-route';
import { moveDemoUnit } from '@/lib/crm/demo-equipment';
import type { DemoMovementType } from '@prisma/client';

const TYPES: DemoMovementType[] = [
  'CHECKOUT',
  'TRANSFER',
  'RETURN',
  'RELOCATE',
  'MAINTENANCE',
  'RETIRE',
];

export const POST = withStaffRoute(async (request, { companyId, userId }, routeContext) => {
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
