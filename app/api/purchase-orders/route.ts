import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hasLegacyRole } from '@/lib/auth/permissions';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';
import type { POStatus } from '@prisma/client';

const PO_STATUSES = new Set<POStatus>(['DRAFT', 'SENT', 'RECEIVED', 'CANCELLED']);

export const GET = withTenantRoute(async (_request, { companyId }) => {
  const orders = await prisma.purchaseOrder.findMany({
    where: { companyId },
    include: { supplier: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return jsonOk(orders);
});

export const POST = withTenantRoute(async (request, { session, companyId }) => {
  if (!hasLegacyRole(session, 'SUPER_ADMIN', 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const supplierId = typeof body.supplierId === 'string' ? body.supplierId.trim() : '';
  const totalAmount = Number(body.totalAmount);
  const statusRaw = typeof body.status === 'string' ? body.status.trim().toUpperCase() : 'DRAFT';
  const status = PO_STATUSES.has(statusRaw as POStatus) ? (statusRaw as POStatus) : 'DRAFT';

  if (!supplierId || Number.isNaN(totalAmount) || totalAmount < 0) {
    return NextResponse.json(
      { error: 'supplierId and a valid totalAmount are required' },
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

  const poNumber = `PO-${Date.now()}`;

  const order = await prisma.purchaseOrder.create({
    data: {
      poNumber,
      supplierId,
      totalAmount,
      status,
      companyId,
    },
    include: { supplier: { select: { id: true, name: true, email: true } } },
  });

  return jsonOk(order, { status: 201 });
});
