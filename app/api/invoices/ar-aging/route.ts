import { prisma } from '@/lib/prisma';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';
import { InvoiceStatus } from '@prisma/client';

const OPEN_STATUSES: InvoiceStatus[] = [
  'SENT',
  'VIEWED',
  'PARTIAL',
  'OVERDUE',
];

type BucketKey = 'current' | 'd31_60' | 'd61_90' | 'd90_plus';

function bucketForDaysPastDue(daysPastDue: number): BucketKey {
  if (daysPastDue <= 30) return 'current';
  if (daysPastDue <= 60) return 'd31_60';
  if (daysPastDue <= 90) return 'd61_90';
  return 'd90_plus';
}

/**
 * GET /api/invoices/ar-aging — receivables aging buckets for unpaid invoices.
 */
export const GET = withTenantRoute(async (_req, { companyId, userId }) => {
  const now = new Date();
  const invoices = await prisma.invoice.findMany({
    where: {
      status: { in: OPEN_STATUSES },
      amountDue: { gt: 0 },
      OR: [
        { userId },
        { customer: { companyId } },
        { lead: { companyId } },
      ],
    },
    select: {
      id: true,
      invoiceNumber: true,
      customerName: true,
      customerEmail: true,
      dueDate: true,
      amountDue: true,
      currency: true,
      status: true,
      total: true,
      amountPaid: true,
    },
    orderBy: { dueDate: 'asc' },
    take: 500,
  });

  const buckets: Record<
    BucketKey,
    { label: string; count: number; amount: number; invoices: typeof invoices }
  > = {
    current: { label: '0–30 days', count: 0, amount: 0, invoices: [] },
    d31_60: { label: '31–60 days', count: 0, amount: 0, invoices: [] },
    d61_90: { label: '61–90 days', count: 0, amount: 0, invoices: [] },
    d90_plus: { label: '90+ days', count: 0, amount: 0, invoices: [] },
  };

  const rows = invoices.map((inv) => {
    const due = new Date(inv.dueDate);
    const daysPastDue = Math.floor(
      (now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)
    );
    const key = bucketForDaysPastDue(Math.max(0, daysPastDue));
    buckets[key].count += 1;
    buckets[key].amount += inv.amountDue;
    buckets[key].invoices.push(inv);
    return {
      ...inv,
      daysPastDue: Math.max(0, daysPastDue),
      bucket: key,
      bucketLabel: buckets[key].label,
    };
  });

  const totalOutstanding = rows.reduce((s, r) => s + r.amountDue, 0);

  return jsonOk({
    asOf: now.toISOString(),
    totalOutstanding,
    totalInvoices: rows.length,
    buckets: {
      current: {
        label: buckets.current.label,
        count: buckets.current.count,
        amount: buckets.current.amount,
      },
      d31_60: {
        label: buckets.d31_60.label,
        count: buckets.d31_60.count,
        amount: buckets.d31_60.amount,
      },
      d61_90: {
        label: buckets.d61_90.label,
        count: buckets.d61_90.count,
        amount: buckets.d61_90.amount,
      },
      d90_plus: {
        label: buckets.d90_plus.label,
        count: buckets.d90_plus.count,
        amount: buckets.d90_plus.amount,
      },
    },
    invoices: rows,
  });
});
