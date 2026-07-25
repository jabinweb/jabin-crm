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

  const departments = await customerService.listDepartments(id);
  return jsonOk({ departments });
});

export const POST = withStaffRoute(async (request, ctx, routeContext) => {
  const { id } = await routeContext!.params;
  const access = await assertCustomerTenantAccess(ctx.session, request, id);
  if (!access) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
  }

  const data = await request.json();
  if (!data.name?.trim()) {
    return NextResponse.json({ error: 'Department name is required' }, { status: 400 });
  }

  try {
    const department = await customerService.createDepartment(id, {
      name: data.name,
      notes: data.notes,
      sortOrder: data.sortOrder,
    });
    return jsonOk(department, { status: 201 });
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
