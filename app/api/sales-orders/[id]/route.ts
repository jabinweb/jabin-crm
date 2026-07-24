import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hasPermissionOrRole } from '@/lib/auth/permissions';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';
import type { SOStatus } from '@prisma/client';

const SO_STATUSES = new Set<SOStatus>([
  'PENDING',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
]);

export const PATCH = withTenantRoute(async (request, { session, companyId }, routeContext) => {
  const allowed = await hasPermissionOrRole(
    session,
    'inventory:write',
    'SUPER_ADMIN',
    'ADMIN'
  );
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const id = (await routeContext!.params).id;
  const body = await request.json();
  const statusRaw = typeof body.status === 'string' ? body.status.trim().toUpperCase() : '';

  if (!SO_STATUSES.has(statusRaw as SOStatus)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const existing = await prisma.salesOrder.findFirst({
    where: { id, companyId },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (existing.status === 'DELIVERED' && statusRaw !== 'DELIVERED') {
    return NextResponse.json(
      { error: 'Delivered orders cannot change status' },
      { status: 400 }
    );
  }

  const order = await prisma.salesOrder.update({
    where: { id },
    data: { status: statusRaw as SOStatus },
  });

  return jsonOk(order);
});
