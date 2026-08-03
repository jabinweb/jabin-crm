import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hasLegacyRole } from '@/lib/auth/permissions';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';

export const PATCH = withTenantRoute(async (request, { session, companyId }, routeContext) => {
  if (!hasLegacyRole(session, 'SUPER_ADMIN', 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const id = (await routeContext!.params).id as string;
  const body = await request.json();
  const data: Record<string, unknown> = {};
  if (typeof body.name === 'string') data.name = body.name.trim();
  if (typeof body.type === 'string') data.type = body.type.trim();
  if (body.value !== undefined) data.value = Number(body.value);
  if (body.depreciation !== undefined) data.depreciation = Number(body.depreciation);
  if (body.purchaseDate) data.purchaseDate = new Date(body.purchaseDate);
  if (body.equipmentInstallationId !== undefined) {
    data.equipmentInstallationId =
      typeof body.equipmentInstallationId === 'string' &&
      body.equipmentInstallationId.trim()
        ? body.equipmentInstallationId.trim()
        : null;
  }

  const updated = await prisma.asset.updateMany({
    where: { id, companyId },
    data,
  });
  if (updated.count === 0) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  }
  const asset = await prisma.asset.findFirst({
    where: { id, companyId },
    include: {
      equipmentInstallation: {
        select: {
          id: true,
          serialNumber: true,
          product: { select: { name: true } },
          customer: { select: { organizationName: true } },
        },
      },
    },
  });
  return jsonOk(asset);
});

export const DELETE = withTenantRoute(async (_request, { session, companyId }, routeContext) => {
  if (!hasLegacyRole(session, 'SUPER_ADMIN', 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const id = (await routeContext!.params).id as string;
  const deleted = await prisma.asset.deleteMany({ where: { id, companyId } });
  if (deleted.count === 0) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  }
  return jsonOk({ success: true });
});
