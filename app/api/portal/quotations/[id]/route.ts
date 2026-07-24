import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import {
  portalBillingWhere,
  resolvePortalCustomerScope,
} from '@/lib/api/portal-billing-scope';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const scope = await resolvePortalCustomerScope(session);
    if (!scope.ok) {
      return NextResponse.json({ error: scope.error }, { status: scope.status });
    }

    const { id } = await params;
    const quotation = await prisma.quotation.findFirst({
      where: { id, ...portalBillingWhere(scope) },
      include: { items: true },
    });
    if (!quotation) {
      return NextResponse.json({ error: 'Quotation not found' }, { status: 404 });
    }

    if (quotation.status === 'SENT') {
      await prisma.quotation.update({
        where: { id },
        data: { status: 'VIEWED' },
      });
      quotation.status = 'VIEWED';
    }

    return NextResponse.json(quotation);
  } catch (error) {
    console.error('[api/portal/quotations/[id] GET]', error);
    return NextResponse.json({ error: 'Failed to load quotation' }, { status: 500 });
  }
}
