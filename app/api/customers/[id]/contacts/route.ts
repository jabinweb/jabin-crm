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

  const customer = await customerService.getCustomerById(id);
  if (!customer) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
  }

  return jsonOk({
    contacts: customer.contacts,
    departments: customer.departments,
  });
});

export const POST = withStaffRoute(async (request, ctx, routeContext) => {
  // Portal (CUSTOMER) users may read their own record but not modify it; technicians
  // work visits and service, not the account itself.
  if (['CUSTOMER', 'TECHNICIAN'].includes(ctx.session.user?.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { id } = await routeContext!.params;
  const access = await assertCustomerTenantAccess(ctx.session, request, id);
  if (!access) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
  }

  const data = await request.json();
  if (!data.name?.trim()) {
    return NextResponse.json({ error: 'Contact name is required' }, { status: 400 });
  }

  const contact = await customerService.addContact(id, {
    name: data.name.trim(),
    role: data.role,
    title: data.title,
    specialty: data.specialty,
    email: data.email,
    phone: data.phone,
    departmentId: data.departmentId,
    isPrimary: !!data.isPrimary,
    isActive: data.isActive !== false,
  });

  return jsonOk(contact, { status: 201 });
});
