import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hasLegacyRole } from '@/lib/auth/permissions';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';
import type { SOStatus } from '@prisma/client';

const SO_STATUSES = new Set<SOStatus>([
  'PENDING',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
]);

export const GET = withTenantRoute(async (_request, { companyId }) => {
  const orders = await prisma.salesOrder.findMany({
    where: { companyId },
    orderBy: { createdAt: 'desc' },
  });
  return jsonOk(orders);
});

export const POST = withTenantRoute(async (request, { session, companyId }) => {
  if (!hasLegacyRole(session, 'SUPER_ADMIN', 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const totalAmount = Number(body.totalAmount);
  const statusRaw = typeof body.status === 'string' ? body.status.trim().toUpperCase() : 'PENDING';
  const status = SO_STATUSES.has(statusRaw as SOStatus) ? (statusRaw as SOStatus) : 'PENDING';

  if (Number.isNaN(totalAmount) || totalAmount < 0) {
    return NextResponse.json({ error: 'A valid totalAmount is required' }, { status: 400 });
  }

  const orderNumber = `SO-${Date.now()}`;

  const order = await prisma.salesOrder.create({
    data: {
      orderNumber,
      totalAmount,
      status,
      companyId,
    },
  });

  return jsonOk(order, { status: 201 });
});
