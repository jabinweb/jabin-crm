import { NextResponse } from 'next/server';
import { checkOpsAccess, COMPANY_ADMIN_ROLES } from '@/lib/crm/ops-access';
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

export const GET = withTenantRoute(async (request, { session, companyId }) => {
  // Admins see every asset; an employee may list only the assets assigned to them
  // (their self-service documents page).
  const ownEmployeeId = request.nextUrl.searchParams.get('employeeId');
  const isOwn = !!ownEmployeeId && ownEmployeeId === session.user.employeeId;
  if (!isOwn) {
    const denied = await checkOpsAccess(session, companyId, { roles: COMPANY_ADMIN_ROLES });
    if (denied) return denied;
  }
  const employeeId = new URL(request.url).searchParams.get('employeeId')
  const assets = await prisma.asset.findMany({
    where: {
      companyId,
      ...(employeeId ? { assignedToEmployeeId: employeeId } : {}),
    },
    include: {
      equipmentInstallation: {
        select: {
          id: true,
          serialNumber: true,
          product: { select: { name: true } },
          customer: { select: { organizationName: true } },
        },
      },
      assignedToEmployee: { select: { id: true, name: true, employeeId: true } },
    },
    orderBy: { purchaseDate: 'desc' },
  });
  return jsonOk(assets);
});

export const POST = withTenantRoute(async (request, { session, companyId }) => {
  if (!hasLegacyRole(session, 'SUPER_ADMIN', 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const type = typeof body.type === 'string' ? body.type.trim() : '';
  const value = Number(body.value);
  const depreciation = Number(body.depreciation ?? 0);
  const purchaseDate = body.purchaseDate ? new Date(body.purchaseDate) : new Date();

  if (!name || !type || Number.isNaN(value) || value < 0) {
    return NextResponse.json(
      { error: 'name, type, and a valid value are required' },
      { status: 400 }
    );
  }
  if (Number.isNaN(depreciation) || depreciation < 0) {
    return NextResponse.json({ error: 'depreciation must be a non-negative number' }, { status: 400 });
  }
  if (Number.isNaN(purchaseDate.getTime())) {
    return NextResponse.json({ error: 'Invalid purchaseDate' }, { status: 400 });
  }

  const equipmentInstallationId =
    typeof body.equipmentInstallationId === 'string' && body.equipmentInstallationId.trim()
      ? body.equipmentInstallationId.trim()
      : null;

  const assignedToEmployeeId =
    typeof body.assignedToEmployeeId === 'string' && body.assignedToEmployeeId.trim()
      ? body.assignedToEmployeeId.trim()
      : null;

  const linkError = await invalidAssetLinks(companyId, equipmentInstallationId, assignedToEmployeeId);
  if (linkError) {
    return NextResponse.json({ error: linkError }, { status: 404 });
  }

  const asset = await prisma.asset.create({
    data: {
      name,
      type,
      value,
      depreciation,
      purchaseDate,
      companyId,
      equipmentInstallationId,
      assignedToEmployeeId,
    },
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

  return jsonOk(asset, { status: 201 });
});
