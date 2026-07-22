import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { assertCustomerTenantAccess } from '@/lib/tenant/scope-staff-query';
import { ensureEquipmentServiceToken } from '@/lib/service-request/tokens';
import { handleRouteError } from '@/lib/api/tenant-response';

type RouteContext = { params: Promise<{ id: string }> };

/** Staff: get or rotate equipment-scoped QR / one-click service link. */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const installation = await prisma.equipmentInstallation.findUnique({
      where: { id },
      select: { id: true, customerId: true },
    });
    if (!installation) {
      return NextResponse.json({ error: 'Equipment not found' }, { status: 404 });
    }

    const access = await assertCustomerTenantAccess(
      session,
      request,
      installation.customerId
    );
    if (!access) {
      return NextResponse.json({ error: 'Equipment not found' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const rotate = Boolean((body as { rotate?: boolean }).rotate);
    const result = await ensureEquipmentServiceToken(id, rotate);

    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
