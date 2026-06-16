import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { productService } from '@/lib/crm/product-service';
import { WORKSPACE_SLUG_HEADER } from '@/lib/api/workspace-slug';
import {
  resolveCompanyContextFromRequest,
  TenantError,
} from '@/lib/auth/company-membership';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || undefined;
    const role = (session.user as any).role as string;

    let products;
    if (role === 'SUPER_ADMIN' && !request.headers.get(WORKSPACE_SLUG_HEADER)?.trim()) {
      products = await productService.listAllProducts(category);
    } else {
      const { companyId } = await resolveCompanyContextFromRequest(session, request);
      products = await productService.listProducts(companyId, category);
    }

    return NextResponse.json(products);
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error fetching products:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role as string)) {
      return NextResponse.json({ error: 'Unauthorized. Admin only.' }, { status: 401 });
    }

    const data = await request.json();
    if (!data.name) {
      return NextResponse.json({ error: 'Product name is required' }, { status: 400 });
    }

    const { companyId: _strip, ...rest } = data;
    const { companyId } = await resolveCompanyContextFromRequest(session, request);
    const product = await productService.createProduct({
      ...rest,
      name: data.name,
      companyId,
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error creating product:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
