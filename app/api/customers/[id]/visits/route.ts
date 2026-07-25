import { NextResponse } from 'next/server';
import { customerService } from '@/lib/crm/customer-service';
import { assertCustomerTenantAccess } from '@/lib/tenant/scope-staff-query';
import { withStaffRoute, jsonOk } from '@/lib/api/with-route';

export const GET = withStaffRoute(async (request, ctx, routeContext) => {
  const { id } = await routeContext!.params;
  const access = await assertCustomerTenantAccess(ctx.session, request, id);
  if (!access) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
  }

  const visits = await customerService.listVisits(id);
  return jsonOk({ visits });
});

export const POST = withStaffRoute(async (request, ctx, routeContext) => {
  const { id } = await routeContext!.params;
  const access = await assertCustomerTenantAccess(ctx.session, request, id);
  if (!access) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
  }

  const companyId = access.companyId;
  if (!companyId) {
    return NextResponse.json({ error: 'Customer has no company' }, { status: 400 });
  }

  const data = await request.json();
  if (!data.scheduledAt) {
    return NextResponse.json({ error: 'scheduledAt is required' }, { status: 400 });
  }

  try {
    const visit = await customerService.createVisit(
      id,
      companyId,
      {
        scheduledAt: data.scheduledAt,
        notes: data.notes,
        assignedTechnicianId: data.assignedTechnicianId,
        departmentId: data.departmentId,
        recurrenceRule: data.recurrenceRule,
        recurrenceUntil: data.recurrenceUntil,
        tagIds: Array.isArray(data.tagIds) ? data.tagIds : [],
        contactIds: Array.isArray(data.contactIds) ? data.contactIds : [],
      },
      ctx.session.user?.id
    );
    return jsonOk(visit, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create visit';
    return NextResponse.json({ error: message }, { status: 400 });
  }
});
