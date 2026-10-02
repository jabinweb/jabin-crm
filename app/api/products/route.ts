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
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const data = await request.json();
  if (!data.name) {
    return NextResponse.json({ error: 'Product name is required' }, { status: 400 });
  }

  // Whitelist writable fields (no mass-assignment of id/companyId/supplierId etc.)
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
  const num = (v: unknown) => {
    const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
    return Number.isFinite(n) ? n : undefined;
  };
  const quantity = num(data.quantity);
  const price = num(data.price);
  const product = await productService.createProduct({
    name: String(data.name).trim(),
    category: str(data.category),
    description: str(data.description),
    manufacturer: str(data.manufacturer),
    modelNumber: str(data.modelNumber),
    ...(data.type === 'EQUIPMENT' || data.type === 'CONSUMABLE'
      ? { type: data.type }
      : {}),
    ...(str(data.sku) ? { sku: str(data.sku) } : {}),
    ...(str(data.imageUrl) ? { imageUrl: str(data.imageUrl) } : {}),
    ...(price !== undefined && price >= 0 ? { price } : {}),
    ...(quantity !== undefined && quantity >= 0 ? { quantity: Math.floor(quantity) } : {}),
    companyId,
  } as Parameters<typeof productService.createProduct>[0]);

  return jsonOk(product, { status: 201 });
});
