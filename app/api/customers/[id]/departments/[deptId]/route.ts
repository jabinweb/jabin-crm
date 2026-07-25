import { NextResponse } from 'next/server';
import { customerService } from '@/lib/crm/customer-service';
import { assertCustomerTenantAccess } from '@/lib/tenant/scope-staff-query';
import { withStaffRoute, jsonOk } from '@/lib/api/with-route';

export const PATCH = withStaffRoute(async (request, ctx, routeContext) => {
  const { id, deptId } = await routeContext!.params;
  const access = await assertCustomerTenantAccess(ctx.session, request, id);
  if (!access) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
  }

  const data = await request.json();
  try {
    const department = await customerService.updateDepartment(id, deptId, {
      name: data.name,
      notes: data.notes,
      sortOrder: data.sortOrder,
    });
    if (!department) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    }
    return jsonOk(department);
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { error: 'A department with this name already exists' },
        { status: 409 }
      );
    }
    throw error;
  }
});

export const DELETE = withStaffRoute(async (request, ctx, routeContext) => {
  const { id, deptId } = await routeContext!.params;
  const access = await assertCustomerTenantAccess(ctx.session, request, id);
  if (!access) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
  }

  const department = await customerService.deleteDepartment(id, deptId);
  if (!department) {
    return NextResponse.json({ error: 'Department not found' }, { status: 404 });
  }

  return jsonOk({ ok: true });
});
