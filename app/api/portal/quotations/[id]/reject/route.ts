import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import {
  portalBillingWhere,
  resolvePortalCustomerScope,
} from '@/lib/api/portal-billing-scope';
import { quotationService } from '@/lib/crm/quotation-service';

const REJECTABLE = new Set(['SENT', 'VIEWED']);

export async function POST(
  req: NextRequest,
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
    if (!REJECTABLE.has(existing.status)) {
      return NextResponse.json(
        { error: `Cannot reject a quotation in ${existing.status} status` },
        { status: 400 }
      );
    }

    let reason: string | undefined;
    try {
      const body = await req.json();
      if (typeof body?.reason === 'string' && body.reason.trim()) {
        reason = body.reason.trim().slice(0, 500);
      }
    } catch {
      // empty body is fine
    }

    const quotation = await quotationService.rejectQuotation(id, reason);
    return NextResponse.json(quotation);
  } catch (error) {
    console.error('[api/portal/quotations/[id]/reject]', error);
    return NextResponse.json({ error: 'Failed to reject quotation' }, { status: 500 });
  }
}
