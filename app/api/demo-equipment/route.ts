import { NextResponse } from 'next/server';
import { checkOpsAccess, SALES_DOC_ROLES } from '@/lib/crm/ops-access';
import { withStaffRoute, jsonOk } from '@/lib/api/with-route';
import {
  createDemoUnit,
  listDemoUnits,
} from '@/lib/crm/demo-equipment';
import { validateDemoUnitRefs } from './_validate-refs';
import type { DemoUnitKind, DemoUnitStatus } from '@prisma/client';

export const GET = withStaffRoute(async (request, { session, companyId }) => {
  // Demo fleet (Ops → Installed equipment): sales-document roles with the Equipment module
  const denied = await checkOpsAccess(session, companyId, { roles: SALES_DOC_ROLES, module: 'EQUIPMENT' });
  if (denied) return denied;
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

export const POST = withStaffRoute(async (request, { session, companyId }) => {
  // Demo fleet (Ops → Installed equipment): sales-document roles with the Equipment module
  const denied = await checkOpsAccess(session, companyId, { roles: SALES_DOC_ROLES, module: 'EQUIPMENT' });
  if (denied) return denied;
  if (!companyId) {
    return NextResponse.json({ error: 'Company context required' }, { status: 400 });
  }
  const body = await request.json();
  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }
  const refError = await validateDemoUnitRefs(companyId, {
    productId: body.productId,
    locationId: body.currentLocationId,
    customerId: body.currentCustomerId,
    custodianUserId: body.custodianUserId,
  });
  if (refError) {
    return NextResponse.json({ error: refError }, { status: 400 });
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
