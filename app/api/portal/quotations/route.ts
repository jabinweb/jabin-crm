import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import {
  portalBillingWhere,
  resolvePortalCustomerScope,
} from '@/lib/api/portal-billing-scope';

export async function GET() {
  try {
    const session = await auth();
    const scope = await resolvePortalCustomerScope(session);
    if (!scope.ok) {
      return NextResponse.json({ error: scope.error }, { status: scope.status });
    }

    const quotations = await prisma.quotation.findMany({
      where: portalBillingWhere(scope),
      select: {
        id: true,
        quotationNumber: true,
        title: true,
        status: true,
        currency: true,
        total: true,
        validUntil: true,
        createdAt: true,
        sentAt: true,
        acceptedAt: true,
        rejectedAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({ quotations });
  } catch (error) {
    console.error('[api/portal/quotations GET]', error);
    return NextResponse.json({ error: 'Failed to load quotations' }, { status: 500 });
  }
}
