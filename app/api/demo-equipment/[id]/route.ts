import { NextResponse } from 'next/server';
import { checkOpsAccess, SALES_DOC_ROLES } from '@/lib/crm/ops-access';
import { withStaffRoute, jsonOk } from '@/lib/api/with-route';
import {
  deleteDemoUnit,
  getDemoUnit,
  updateDemoUnit,
} from '@/lib/crm/demo-equipment';
import { validateDemoUnitRefs } from '../_validate-refs';

export const GET = withStaffRoute(async (_request, { session, companyId }, routeContext) => {
  // Demo fleet (Ops → Installed equipment): sales-document roles with the Equipment module
  const denied = await checkOpsAccess(session, companyId, { roles: SALES_DOC_ROLES, module: 'EQUIPMENT' });
  if (denied) return denied;
  if (!companyId) {
    return NextResponse.json({ error: 'Company context required' }, { status: 400 });
  }
  const { id } = await routeContext!.params;
  const unit = await getDemoUnit(companyId, id);
  if (!unit) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return jsonOk(unit);
});

export const PATCH = withStaffRoute(async (request, { session, companyId }, routeContext) => {
  // Demo fleet (Ops → Installed equipment): sales-document roles with the Equipment module
  const denied = await checkOpsAccess(session, companyId, { roles: SALES_DOC_ROLES, module: 'EQUIPMENT' });
  if (denied) return denied;
  if (!companyId) {
    return NextResponse.json({ error: 'Company context required' }, { status: 400 });
  }
  const { id } = await routeContext!.params;
  const body = await request.json();
  const refError = await validateDemoUnitRefs(companyId, {
    productId: body.productId,
    locationId: body.currentLocationId,
    customerId: body.currentCustomerId,
    custodianUserId: body.custodianUserId,
  });
  if (refError) {
    return NextResponse.json({ error: refError }, { status: 400 });
  }
  const unit = await updateDemoUnit(companyId, id, body);
  if (!unit) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return jsonOk(unit);
});

export const DELETE = withStaffRoute(async (_request, { session, companyId }, routeContext) => {
  // Demo fleet (Ops → Installed equipment): sales-document roles with the Equipment module
  const denied = await checkOpsAccess(session, companyId, { roles: SALES_DOC_ROLES, module: 'EQUIPMENT' });
  if (denied) return denied;
  if (!companyId) {
    return NextResponse.json({ error: 'Company context required' }, { status: 400 });
  }
  const { id } = await routeContext!.params;
  const result = await deleteDemoUnit(companyId, id);
  if (!result) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return jsonOk(result);
});
