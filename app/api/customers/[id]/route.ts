import { NextResponse } from 'next/server';
import { customerService } from '@/lib/crm/customer-service';
import { assertCustomerTenantAccess } from '@/lib/tenant/scope-staff-query';
import { prisma } from '@/lib/prisma';
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

  return jsonOk(customer);
});

export const PATCH = withStaffRoute(async (request, ctx, routeContext) => {
  const { id } = await routeContext!.params;

  const access = await assertCustomerTenantAccess(ctx.session, request, id);
  if (!access) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
  }

  const data = await request.json();
  const customer = await customerService.updateCustomer(id, data);
  return jsonOk(customer);
});

export const DELETE = withStaffRoute(async (request, ctx, routeContext) => {
  const { id } = await routeContext!.params;

  const access = await assertCustomerTenantAccess(ctx.session, request, id);
  if (!access) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
  }

  await prisma.customer.delete({ where: { id } });
  return jsonOk({ message: 'Customer deleted successfully' });
});
