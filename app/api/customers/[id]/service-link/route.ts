import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { assertCustomerTenantAccess } from '@/lib/tenant/scope-staff-query';
import { ensureCustomerServiceToken } from '@/lib/service-request/tokens';
import { handleRouteError } from '@/lib/api/tenant-response';

type RouteContext = { params: Promise<{ id: string }> };

/** Staff: get or rotate the client's one-click / QR service link. */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const access = await assertCustomerTenantAccess(session, request, id);
    if (!access) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const rotate = Boolean((body as { rotate?: boolean }).rotate);
    const result = await ensureCustomerServiceToken(id, rotate);

    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
