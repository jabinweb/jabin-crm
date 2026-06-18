import { handleRouteError } from '@/lib/api/tenant-response';
import { NextRequest, NextResponse } from 'next/server';
import { productService } from '@/lib/crm/product-service';
import { WORKSPACE_SLUG_HEADER } from '@/lib/api/workspace-slug';
import { withApiRoute, withTenantRoute, jsonOk } from '@/lib/api/with-route';
import { hasLegacyRole } from '@/lib/auth/permissions';

export const GET = withApiRoute({
  auth: 'session',
  handler: async (request, { session }) => {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || undefined;
    const role = session.user.role as string;

    if (role === 'SUPER_ADMIN' && !request.headers.get(WORKSPACE_SLUG_HEADER)?.trim()) {
      return jsonOk(await productService.listAllProducts(category));
    }

    const { resolveCompanyContextFromRequest } = await import('@/lib/auth/company-membership');
    const { companyId } = await resolveCompanyContextFromRequest(session, request);
    return jsonOk(await productService.listProducts(companyId, category));
  },
});

export const POST = withTenantRoute(async (request, { session, companyId }) => {
  if (!hasLegacyRole(session, 'ADMIN', 'SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized. Admin only.' }, { status: 401 });
  }

  const data = await request.json();
  if (!data.name) {
    return NextResponse.json({ error: 'Product name is required' }, { status: 400 });
  }

  const { companyId: _strip, ...rest } = data;
  const product = await productService.createProduct({
    ...rest,
    name: data.name,
    companyId,
  });

  return jsonOk(product, { status: 201 });
});
