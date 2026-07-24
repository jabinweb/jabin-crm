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

    const invoices = await prisma.invoice.findMany({
      where: portalBillingWhere(scope),
      select: {
        id: true,
        invoiceNumber: true,
        title: true,
        status: true,
        currency: true,
        total: true,
        amountPaid: true,
        amountDue: true,
        dueDate: true,
        createdAt: true,
        sentAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({ invoices });
  } catch (error) {
    console.error('[api/portal/invoices GET]', error);
    return NextResponse.json({ error: 'Failed to load invoices' }, { status: 500 });
  }
}
