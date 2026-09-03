import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { resolvePortalCustomerScope } from '@/lib/api/portal-billing-scope';

/** GET /api/portal/retainers — active retainers for the signed-in customer. */
export async function GET() {
  try {
    const session = await auth();
    const scope = await resolvePortalCustomerScope(session);
    if (!scope.ok) {
      return NextResponse.json({ error: scope.error }, { status: scope.status });
    }

    const retainers = await prisma.clientRetainer.findMany({
      where: {
        customerId: scope.customerId,
        status: { not: 'CANCELLED' },
      },
      select: {
        id: true,
        name: true,
        description: true,
        amount: true,
        currency: true,
        billingCycle: true,
        status: true,
        includedHours: true,
        nextBillAt: true,
        lastBilledAt: true,
        startDate: true,
        project: {
          select: { id: true, name: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json(retainers);
  } catch (error) {
    console.error('[api/portal/retainers GET]', error);
    return NextResponse.json({ error: 'Failed to load retainers' }, { status: 500 });
  }
}
