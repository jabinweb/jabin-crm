import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import {
  portalBillingWhere,
  resolvePortalCustomerScope,
} from '@/lib/api/portal-billing-scope';
import { quotationService } from '@/lib/crm/quotation-service';

const ACCEPTABLE = new Set(['SENT', 'VIEWED']);

export async function POST(
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
    const existing = await prisma.quotation.findFirst({
      where: { id, ...portalBillingWhere(scope) },
      select: { id: true, status: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Quotation not found' }, { status: 404 });
    }
    if (!ACCEPTABLE.has(existing.status)) {
      return NextResponse.json(
        { error: `Cannot accept a quotation in ${existing.status} status` },
        { status: 400 }
      );
    }

    const quotation = await quotationService.acceptQuotation(id);
    return NextResponse.json(quotation);
  } catch (error) {
    console.error('[api/portal/quotations/[id]/accept]', error);
    return NextResponse.json({ error: 'Failed to accept quotation' }, { status: 500 });
  }
}
