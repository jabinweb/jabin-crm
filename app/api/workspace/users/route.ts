import { NextResponse } from 'next/server';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';
import { hasLegacyRole } from '@/lib/auth/permissions';
import { prisma } from '@/lib/prisma';
import { UserRole } from '@prisma/client';

/**
 * List users belonging to the current workspace (ADMIN / SUPER_ADMIN).
 * Distinct from platform `/api/admin/users` (SUPER_ADMIN, all tenants).
 */
export const GET = withTenantRoute(async (_request, { session, companyId }) => {
  if (!hasLegacyRole(session, 'ADMIN', 'SUPER_ADMIN')) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const memberships = await prisma.userCompany.findMany({
    where: { companyId },
    select: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          userStatus: true,
          createdAt: true,
          primaryCompany: {
            select: { id: true, name: true, status: true },
          },
        },
      },
    },
    orderBy: { user: { createdAt: 'desc' } },
  });

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true, status: true },
  });

  const byId = new Map<
    string,
    {
      id: string;
      name: string | null;
      email: string;
      role: UserRole;
      status: string;
      createdAt: Date;
      primaryCompany: { id: string; name: string; status: string } | null;
      companies: Array<{ id: string; name: string; status: string }>;
    }
  >();

  for (const row of memberships) {
    const u = row.user;
    if (u.role === UserRole.SUPER_ADMIN) continue;
    byId.set(u.id, {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      status: u.userStatus,
      createdAt: u.createdAt,
      primaryCompany: u.primaryCompany,
      companies: company ? [company] : [],
    });
  }

  // Also include users whose primaryCompany is this workspace (legacy links)
  const primaryUsers = await prisma.user.findMany({
    where: {
      primaryCompanyId: companyId,
      role: { not: UserRole.SUPER_ADMIN },
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      userStatus: true,
      createdAt: true,
      primaryCompany: {
        select: { id: true, name: true, status: true },
      },
    },
  });

  for (const u of primaryUsers) {
    if (byId.has(u.id)) continue;
    byId.set(u.id, {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      status: u.userStatus,
      createdAt: u.createdAt,
      primaryCompany: u.primaryCompany,
      companies: company ? [company] : [],
    });
  }

  return jsonOk({
    success: true,
    data: Array.from(byId.values()),
  });
});
