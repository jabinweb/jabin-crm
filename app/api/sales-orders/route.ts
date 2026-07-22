import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hasLegacyRole, hasPermissionOrRole } from '@/lib/auth/permissions';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';
import type { SOStatus } from '@prisma/client';

const SO_STATUSES = new Set<SOStatus>([
  'PENDING',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
]);

type LineItem = {
  productId: string;
  name?: string;
  quantity: number;
  unitPrice: number;
};

function parseLineItems(raw: unknown): LineItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      const r = row as Record<string, unknown>;
      const productId = typeof r.productId === 'string' ? r.productId : '';
      const quantity = Number(r.quantity);
      const unitPrice = Number(r.unitPrice);
      if (!productId || !(quantity > 0) || Number.isNaN(unitPrice) || unitPrice < 0) {
        return null;
      }
      return {
        productId,
        name: typeof r.name === 'string' ? r.name : undefined,
        quantity,
        unitPrice,
      };
    })
    .filter(Boolean) as LineItem[];
}

export const GET = withTenantRoute(async (request, { companyId }) => {
  const report = new URL(request.url).searchParams.get('report') === '1';
  const orders = await prisma.salesOrder.findMany({
    where: { companyId },
    orderBy: { createdAt: 'desc' },
  });

  if (!report) return jsonOk(orders);

  const byStatus: Record<string, number> = {};
  let totalRevenue = 0;
  let openCount = 0;
  for (const o of orders) {
    byStatus[o.status] = (byStatus[o.status] || 0) + 1;
    totalRevenue += o.totalAmount;
    if (o.status === 'PENDING' || o.status === 'PROCESSING') openCount += 1;
  }
  return jsonOk({
    orders,
    report: {
      count: orders.length,
      openCount,
      totalRevenue,
      byStatus,
    },
  });
});

export const POST = withTenantRoute(async (request, { session, companyId }) => {
  const allowed = await hasPermissionOrRole(
    session,
    'inventory:write',
    'SUPER_ADMIN',
    'ADMIN'
  );
  if (!allowed && !hasLegacyRole(session, 'SUPER_ADMIN', 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const lineItems = parseLineItems(body.lineItems);
  let totalAmount = Number(body.totalAmount);
  if (lineItems.length) {
    totalAmount = lineItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  }
  const statusRaw = typeof body.status === 'string' ? body.status.trim().toUpperCase() : 'PENDING';
  const status = SO_STATUSES.has(statusRaw as SOStatus) ? (statusRaw as SOStatus) : 'PENDING';
  const notes = typeof body.notes === 'string' ? body.notes : null;

  if (Number.isNaN(totalAmount) || totalAmount < 0) {
    return NextResponse.json(
      { error: 'A valid totalAmount (or lineItems) is required' },
      { status: 400 }
    );
  }

  if (lineItems.length) {
    const ids = lineItems.map((i) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: ids }, companyId },
      select: { id: true },
    });
    if (products.length !== ids.length) {
      return NextResponse.json({ error: 'One or more products not found' }, { status: 400 });
    }
  }

  const orderNumber = `SO-${Date.now()}`;
  const productConnect = lineItems.map((i) => ({ id: i.productId }));

  const order = await prisma.salesOrder.create({
    data: {
      orderNumber,
      totalAmount,
      status,
      companyId,
      notes,
      lineItems: lineItems.length ? lineItems : undefined,
      ...(productConnect.length
        ? { products: { connect: productConnect } }
        : {}),
    },
  });

  return jsonOk(order, { status: 201 });
});
