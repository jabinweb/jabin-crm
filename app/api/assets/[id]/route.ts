import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hasLegacyRole } from '@/lib/auth/permissions';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';

/** Reject links to equipment / employees that belong to another workspace. */
async function invalidAssetLinks(
  companyId: string,
  equipmentInstallationId: string | null | undefined,
  assignedToEmployeeId: string | null | undefined
): Promise<string | null> {
  if (equipmentInstallationId) {
    const eq = await prisma.equipmentInstallation.findFirst({
      where: { id: equipmentInstallationId, customer: { companyId } },
      select: { id: true },
    });
    if (!eq) return 'Equipment not found';
  }
  if (assignedToEmployeeId) {
    const emp = await prisma.employee.findFirst({
      where: { id: assignedToEmployeeId, companyId },
      select: { id: true },
    });
    if (!emp) return 'Employee not found';
  }
  return null;
}

export const PATCH = withTenantRoute(async (request, { session, companyId }, routeContext) => {
  if (!hasLegacyRole(session, 'SUPER_ADMIN', 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const id = (await routeContext!.params).id as string;
  const body = await request.json();
  const data: Record<string, unknown> = {};
  if (typeof body.name === 'string') data.name = body.name.trim();
  if (typeof body.type === 'string') data.type = body.type.trim();
  if (body.value !== undefined) {
    const value = Number(body.value);
    if (body.value === null || body.value === '' || Number.isNaN(value) || value < 0) {
      return NextResponse.json({ error: 'value must be a non-negative number' }, { status: 400 });
    }
    data.value = value;
  }
  if (body.depreciation !== undefined) {
    const depreciation = Number(body.depreciation);
    if (body.depreciation === null || body.depreciation === '' || Number.isNaN(depreciation) || depreciation < 0) {
      return NextResponse.json({ error: 'depreciation must be a non-negative number' }, { status: 400 });
    }
    data.depreciation = depreciation;
  }
  if (body.purchaseDate) {
    const purchaseDate = new Date(body.purchaseDate);
    if (Number.isNaN(purchaseDate.getTime())) {
      return NextResponse.json({ error: 'Invalid purchaseDate' }, { status: 400 });
    }
    data.purchaseDate = purchaseDate;
  }
  if (body.equipmentInstallationId !== undefined) {
    data.equipmentInstallationId =
      typeof body.equipmentInstallationId === 'string' &&
      body.equipmentInstallationId.trim()
        ? body.equipmentInstallationId.trim()
        : null;
  }
  if (body.assignedToEmployeeId !== undefined) {
    data.assignedToEmployeeId =
      typeof body.assignedToEmployeeId === 'string' && body.assignedToEmployeeId.trim()
        ? body.assignedToEmployeeId.trim()
        : null;
  }

  const linkError = await invalidAssetLinks(
    companyId,
    data.equipmentInstallationId as string | null | undefined,
    data.assignedToEmployeeId as string | null | undefined
  );
  if (linkError) {
    return NextResponse.json({ error: linkError }, { status: 404 });
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
