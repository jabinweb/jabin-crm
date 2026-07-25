import { NextResponse } from 'next/server';
import { customerService } from '@/lib/crm/customer-service';
import { assertCustomerTenantAccess } from '@/lib/tenant/scope-staff-query';
import { withStaffRoute, jsonOk } from '@/lib/api/with-route';

export const PATCH = withStaffRoute(async (request, ctx, routeContext) => {
  const { id, contactId } = await routeContext!.params;
  const access = await assertCustomerTenantAccess(ctx.session, request, id);
  if (!access) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
  }

  const data = await request.json();
  const contact = await customerService.updateContact(id, contactId, {
    name: data.name,
    role: data.role,
    title: data.title,
    specialty: data.specialty,
    email: data.email,
    phone: data.phone,
    departmentId: data.departmentId,
    isPrimary: data.isPrimary,
    isActive: data.isActive,
  });

  if (!contact) {
    return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
  }

  return jsonOk(contact);
});

export const DELETE = withStaffRoute(async (request, ctx, routeContext) => {
  const { id, contactId } = await routeContext!.params;
  const access = await assertCustomerTenantAccess(ctx.session, request, id);
  if (!access) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
  }

  const contact = await customerService.deleteContact(id, contactId);
  if (!contact) {
    return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
  }

  return jsonOk({ ok: true });
});
