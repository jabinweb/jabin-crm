import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import {
  portalBillingWhere,
  resolvePortalCustomerScope,
} from '@/lib/api/portal-billing-scope';

export type PortalDocument = {
  id: string;
  type: 'invoice' | 'quotation' | 'contract';
  title: string;
  number: string | null;
  status: string;
  currency?: string | null;
  amount?: number | null;
  date: string;
  href: string;
  downloadHref?: string;
};

export async function GET() {
  try {
    const session = await auth();
    const scope = await resolvePortalCustomerScope(session);
    if (!scope.ok) {
      return NextResponse.json({ error: scope.error }, { status: scope.status });
    }

    const billingWhere = portalBillingWhere(scope);

    const [invoices, quotations, contracts] = await Promise.all([
      prisma.invoice.findMany({
        where: billingWhere,
        select: {
          id: true,
          invoiceNumber: true,
          title: true,
          status: true,
          currency: true,
          total: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.quotation.findMany({
        where: billingWhere,
        select: {
          id: true,
          quotationNumber: true,
          title: true,
          status: true,
          currency: true,
          total: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.serviceContract.findMany({
        where: {
          customerId: scope.customerId,
          status: { not: 'DRAFT' },
        },
        select: {
          id: true,
          contractNumber: true,
          title: true,
          status: true,
          currency: true,
          annualValue: true,
          startDate: true,
          endDate: true,
          type: true,
        },
        orderBy: { startDate: 'desc' },
        take: 50,
      }),
    ]);

    const documents: PortalDocument[] = [
      ...invoices.map((inv) => ({
        id: inv.id,
        type: 'invoice' as const,
        title: inv.title,
        number: inv.invoiceNumber,
        status: inv.status,
        currency: inv.currency,
        amount: inv.total,
        date: inv.createdAt.toISOString(),
        href: `/portal/invoices/${inv.id}`,
        downloadHref: `/api/portal/invoices/${inv.id}/pdf`,
      })),
      ...quotations.map((q) => ({
        id: q.id,
        type: 'quotation' as const,
        title: q.title,
        number: q.quotationNumber,
        status: q.status,
        currency: q.currency,
        amount: q.total,
        date: q.createdAt.toISOString(),
        href: `/portal/quotations/${q.id}`,
        downloadHref: `/api/portal/quotations/${q.id}/pdf`,
      })),
      ...contracts.map((c) => ({
        id: c.id,
        type: 'contract' as const,
        title: `${c.type}: ${c.title}`,
        number: c.contractNumber,
        status: c.status,
        currency: c.currency,
        amount: c.annualValue,
        date: c.startDate.toISOString(),
        href: `/portal/contracts/${c.id}`,
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json({ documents });
  } catch (error) {
    console.error('[api/portal/documents GET]', error);
    return NextResponse.json({ error: 'Failed to load documents' }, { status: 500 });
  }
}
