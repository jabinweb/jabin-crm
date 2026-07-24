import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import {
  portalBillingWhere,
  resolvePortalCustomerScope,
} from '@/lib/api/portal-billing-scope';
import { invoiceService } from '@/lib/crm/invoice-service';

async function assertOwnedInvoice(id: string, scope: { customerId: string; email: string | null }) {
  return prisma.invoice.findFirst({
    where: {
      id,
      ...portalBillingWhere(scope),
    },
    include: {
      items: true,
      payments: {
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
    },
  });
}

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
    const invoice = await assertOwnedInvoice(id, scope);
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (invoice.status === 'SENT') {
      void invoiceService.markAsViewed(id);
    }

    let paymentDetails: Record<string, string> | null = null;
    if (invoice.paymentDetails) {
      try {
        paymentDetails = JSON.parse(invoice.paymentDetails);
      } catch {
        paymentDetails = null;
      }
    }

    return NextResponse.json({ ...invoice, paymentDetailsParsed: paymentDetails });
  } catch (error) {
    console.error('[api/portal/invoices/[id] GET]', error);
    return NextResponse.json({ error: 'Failed to load invoice' }, { status: 500 });
  }
}
