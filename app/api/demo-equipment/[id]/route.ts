import { NextResponse } from 'next/server';
import { withStaffRoute, jsonOk } from '@/lib/api/with-route';
import {
  deleteDemoUnit,
  getDemoUnit,
  updateDemoUnit,
} from '@/lib/crm/demo-equipment';

export const GET = withStaffRoute(async (_request, { companyId }, routeContext) => {
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

export const PATCH = withStaffRoute(async (request, { companyId }, routeContext) => {
  if (!companyId) {
    return NextResponse.json({ error: 'Company context required' }, { status: 400 });
  }
  const { id } = await routeContext!.params;
  const body = await request.json();
  const unit = await updateDemoUnit(companyId, id, body);
  if (!unit) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return jsonOk(unit);
});

export const DELETE = withStaffRoute(async (_request, { companyId }, routeContext) => {
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
