import { NextResponse } from 'next/server';
import { UserRole } from '@prisma/client';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';
import { hasLegacyRole, hasPermissionOrRole } from '@/lib/auth/permissions';
import { prisma } from '@/lib/prisma';
import {
  TENANT_ROLE_PERMISSIONS,
  PERMISSIONS,
  ensureRbacCatalog,
  syncUserRoleAssignment,
} from '@/lib/auth/rbac-catalog';

const EDITABLE_ROLES: UserRole[] = [
  UserRole.ADMIN,
  UserRole.SALES,
  UserRole.SUPPORT_MANAGER,
  UserRole.TECHNICIAN,
];

export const GET = withTenantRoute(async (_request, { session, companyId }) => {
  if (!hasLegacyRole(session, 'ADMIN', 'SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await ensureRbacCatalog();

  const members = await prisma.user.findMany({
    where: {
      OR: [
        { primaryCompanyId: companyId },
        { userCompanies: { some: { companyId } } },
      ],
      role: { in: EDITABLE_ROLES },
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      userStatus: true,
    },
    orderBy: { name: 'asc' },
  });

  return jsonOk({
    permissions: PERMISSIONS,
    roleMatrix: TENANT_ROLE_PERMISSIONS,
    members,
  });
});

export const PATCH = withTenantRoute(async (request, { session, companyId }) => {
  if (!(await hasPermissionOrRole(session, 'hr:admin', 'ADMIN', 'SUPER_ADMIN'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const userId = typeof body.userId === 'string' ? body.userId : '';
  const roleRaw = String(body.role || '').toUpperCase() as UserRole;

  if (!userId || !EDITABLE_ROLES.includes(roleRaw)) {
    return NextResponse.json({ error: 'Valid userId and role are required' }, { status: 400 });
  }

  // `hr:admin` holders may manage staff roles but must not mint workspace admins
  // (or demote one) — that stays with ADMIN / SUPER_ADMIN.
  const callerIsAdmin = hasLegacyRole(session, 'ADMIN', 'SUPER_ADMIN');
  if (roleRaw === UserRole.ADMIN && !callerIsAdmin) {
    return NextResponse.json({ error: 'Only an admin can grant the ADMIN role' }, { status: 403 });
  }

  const member = await prisma.user.findFirst({
    where: {
      id: userId,
      OR: [
        { primaryCompanyId: companyId },
        { userCompanies: { some: { companyId } } },
      ],
    },
    select: { id: true, role: true },
  });

  if (!member) {
    return NextResponse.json({ error: 'User not found in workspace' }, { status: 404 });
  }

  if (member.role === UserRole.SUPER_ADMIN) {
    return NextResponse.json({ error: 'Cannot change SUPER_ADMIN role' }, { status: 400 });
  }
  if (member.role === UserRole.ADMIN && !callerIsAdmin) {
    return NextResponse.json({ error: 'Only an admin can change an admin' }, { status: 403 });
  }

  // User.role is global: changing it here would also change the user's rights in every
  // other workspace they belong to, so only allow it for users scoped to this one.
  if (!hasLegacyRole(session, 'SUPER_ADMIN')) {
    const otherWorkspace = await prisma.user.findFirst({
      where: {
        id: userId,
        OR: [
          { primaryCompanyId: { not: companyId } },
          { companyId: { not: companyId } },
          { userCompanies: { some: { companyId: { not: companyId } } } },
        ],
      },
      select: { id: true },
    });
    if (otherWorkspace) {
      return NextResponse.json(
        { error: 'This user also belongs to another workspace; their role cannot be changed here' },
        { status: 409 }
      );
    }
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { role: roleRaw },
    select: { id: true, name: true, email: true, role: true },
  });

  await ensureRbacCatalog();
  await syncUserRoleAssignment(userId, roleRaw);

  return jsonOk({ member: updated });
});
