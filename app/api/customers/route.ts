import { NextRequest, NextResponse } from 'next/server';
import { customerService } from '@/lib/crm/customer-service';
import { withTenantRoute, withApiRoute, jsonOk } from '@/lib/api/with-route';

export const GET = withApiRoute({
  auth: 'tenant-optional',
  handler: async (request, { companyId }) => {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || undefined;
    const city = searchParams.get('city') || undefined;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    const result = await customerService.listCustomers({
      search,
      city,
      page,
      limit,
      companyId,
    });

    return jsonOk(result);
  },
});

export const POST = withTenantRoute(async (request, { companyId }) => {
  const data = await request.json();

  if (!data.organizationName || !data.contactPerson) {
    return NextResponse.json(
      { error: 'Organization name and contact person are required' },
      { status: 400 }
    );
  }

  const customer = await customerService.createCustomer({
    ...data,
    companyId,
  });

  return jsonOk(customer, { status: 201 });
});
