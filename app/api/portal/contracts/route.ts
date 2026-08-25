import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { resolvePortalCustomerScope } from '@/lib/api/portal-billing-scope';

export async function GET() {
  try {
    const session = await auth();
    const scope = await resolvePortalCustomerScope(session);
    if (!scope.ok) {
      return NextResponse.json({ error: scope.error }, { status: scope.status });
    }

    const contracts = await prisma.serviceContract.findMany({
      where: {
        customerId: scope.customerId,
        status: { not: 'DRAFT' },
      },
      select: {
        id: true,
        type: true,
        status: true,
        contractNumber: true,
        title: true,
        startDate: true,
        endDate: true,
        annualValue: true,
        currency: true,
      },
      orderBy: { endDate: 'desc' },
    });

    return NextResponse.json(contracts);
  } catch (error) {
    console.error('[api/portal/contracts GET]', error);
    return NextResponse.json({ error: 'Failed to load contracts' }, { status: 500 });
  }
}
