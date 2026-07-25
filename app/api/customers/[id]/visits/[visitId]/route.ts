import { NextResponse } from 'next/server';
import { customerService } from '@/lib/crm/customer-service';
import { assertCustomerTenantAccess } from '@/lib/tenant/scope-staff-query';
import { withStaffRoute, jsonOk } from '@/lib/api/with-route';

export const PATCH = withStaffRoute(async (request, ctx, routeContext) => {
  const { id, visitId } = await routeContext!.params;
  const access = await assertCustomerTenantAccess(ctx.session, request, id);
  if (!access) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
  }

  const data = await request.json();
  const visit = await customerService.updateVisit(id, visitId, {
    scheduledAt: data.scheduledAt,
    notes: data.notes,
    assignedTechnicianId: data.assignedTechnicianId,
    departmentId: data.departmentId,
    recurrenceRule: data.recurrenceRule,
    recurrenceUntil: data.recurrenceUntil,
    tagIds: data.tagIds,
    contactIds: data.contactIds,
    status: data.status,
  });

  if (!visit) {
    return NextResponse.json({ error: 'Visit not found' }, { status: 404 });
  }

  return jsonOk(visit);
});

export const DELETE = withStaffRoute(async (request, ctx, routeContext) => {
  const { id, visitId } = await routeContext!.params;
  const access = await assertCustomerTenantAccess(ctx.session, request, id);
  if (!access) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
  }

  const visit = await customerService.deleteVisit(id, visitId);
  if (!visit) {
    return NextResponse.json({ error: 'Visit not found' }, { status: 404 });
  }

  return jsonOk({ ok: true });
});
