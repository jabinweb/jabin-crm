import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hasLegacyRole, hasPermissionOrRole } from '@/lib/auth/permissions';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';
import type { POStatus, Prisma } from '@prisma/client';

const PO_STATUSES = new Set<POStatus>(['DRAFT', 'SENT', 'RECEIVED', 'CANCELLED']);

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
  const orders = await prisma.purchaseOrder.findMany({
    where: { companyId },
    include: { supplier: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
  });

  if (!report) return jsonOk(orders);

  const byStatus: Record<string, number> = {};
  let totalSpend = 0;
  let openCount = 0;
  for (const o of orders) {
    byStatus[o.status] = (byStatus[o.status] || 0) + 1;
    totalSpend += o.totalAmount;
    if (o.status === 'DRAFT' || o.status === 'SENT') openCount += 1;
  }
  return jsonOk({
    orders,
    report: {
      count: orders.length,
      openCount,
      totalSpend,
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
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const supplierId = typeof body.supplierId === 'string' ? body.supplierId.trim() : '';
  const lineItems = parseLineItems(body.lineItems);
  let totalAmount = Number(body.totalAmount);
  if (lineItems.length) {
    totalAmount = lineItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  }
  const statusRaw = typeof body.status === 'string' ? body.status.trim().toUpperCase() : 'DRAFT';
  const status = PO_STATUSES.has(statusRaw as POStatus) ? (statusRaw as POStatus) : 'DRAFT';
  const notes = typeof body.notes === 'string' ? body.notes : null;

  if (!supplierId || Number.isNaN(totalAmount) || totalAmount < 0) {
    return NextResponse.json(
      { error: 'supplierId and a valid totalAmount (or lineItems) are required' },
      { status: 400 }
    );
  }

  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, companyId },
    select: { id: true },
  });
  if (!supplier) {
    return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
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

  const poNumber = `PO-${Date.now()}`;
  const productConnect = lineItems.map((i) => ({ id: i.productId }));

  const order = await prisma.purchaseOrder.create({
    data: {
      poNumber,
      supplierId,
      totalAmount,
      status,
      companyId,
      notes,
      lineItems: lineItems.length ? (lineItems as unknown as Prisma.InputJsonValue) : undefined,
      ...(productConnect.length
        ? { products: { connect: productConnect } }
        : {}),
    },
    include: { supplier: { select: { id: true, name: true, email: true } } },
  });

  return jsonOk(order, { status: 201 });
});
