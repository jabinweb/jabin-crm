import { NextResponse } from 'next/server';
import { withStaffRoute, jsonOk } from '@/lib/api/with-route';
import {
  createDemoUnit,
  listDemoUnits,
} from '@/lib/crm/demo-equipment';
import type { DemoUnitKind, DemoUnitStatus } from '@prisma/client';

export const GET = withStaffRoute(async (request, { companyId }) => {
  if (!companyId) {
    return NextResponse.json({ error: 'Company context required' }, { status: 400 });
  }
  const { searchParams } = new URL(request.url);
  const status = (searchParams.get('status') || undefined) as DemoUnitStatus | undefined;
  const kind = (searchParams.get('kind') || undefined) as DemoUnitKind | undefined;
  const q = searchParams.get('q') || undefined;
  const units = await listDemoUnits(companyId, { status, kind, q });
  return jsonOk({ units });
});

export const POST = withStaffRoute(async (request, { companyId }) => {
  if (!companyId) {
    return NextResponse.json({ error: 'Company context required' }, { status: 400 });
  }
  const body = await request.json();
  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }
  const unit = await createDemoUnit(companyId, {
    name: body.name,
    kind: body.kind,
    productId: body.productId,
    serialNumber: body.serialNumber,
    assetTag: body.assetTag,
    status: body.status,
    currentLocationId: body.currentLocationId,
    currentCustomerId: body.currentCustomerId,
    custodianUserId: body.custodianUserId,
    notes: body.notes,
    expectedReturnAt: body.expectedReturnAt,
  });
  return jsonOk(unit, { status: 201 });
});
