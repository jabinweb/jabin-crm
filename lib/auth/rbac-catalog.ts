import { prisma } from '@/lib/prisma';
import type { UserRole } from '@prisma/client';

/** Canonical permission names used across the app. */
export const PERMISSIONS = [
  'leads:read',
  'leads:write',
  'tickets:read',
  'tickets:write',
  'inventory:read',
  'inventory:write',
  'finance:read',
  'finance:write',
  'hr:admin',
  'billing:manage',
  'platform:admin',
] as const;

export type PermissionName = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<string, PermissionName[]> = {
  SUPER_ADMIN: [...PERMISSIONS],
  ADMIN: [
    'leads:read',
    'leads:write',
    'tickets:read',
    'tickets:write',
    'inventory:read',
    'inventory:write',
    'finance:read',
    'finance:write',
    'hr:admin',
    'billing:manage',
  ],
  SUPPORT_MANAGER: [
    'leads:read',
    'tickets:read',
    'tickets:write',
    'inventory:read',
  ],
  SALES: ['leads:read', 'leads:write', 'tickets:read'],
  TECHNICIAN: ['tickets:read', 'tickets:write', 'inventory:read'],
  CUSTOMER: ['tickets:read', 'tickets:write'],
};

/** Ensure Role / Permission rows exist and map UserRole enums → RBAC. */
export async function ensureRbacCatalog() {
  for (const name of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { name },
      create: { name, description: name },
      update: {},
    });
  }

  const allPerms = await prisma.permission.findMany();
  const byName = Object.fromEntries(allPerms.map((p) => [p.name, p.id]));

  for (const [roleName, perms] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      create: {
        name: roleName,
        description: `${roleName} (synced from UserRole)`,
      },
      update: {},
    });

    for (const permName of perms) {
      const permissionId = byName[permName];
      if (!permissionId) continue;
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: role.id, permissionId },
        },
        create: { roleId: role.id, permissionId },
        update: {},
      });
    }
  }
}

/** Assign the RBAC Role matching the user's UserRole enum. */
export async function syncUserRoleAssignment(userId: string, userRole: UserRole | string) {
  const roleName = String(userRole);
  const role = await prisma.role.findUnique({ where: { name: roleName } });
  if (!role) return;

  const otherNames = Object.keys(ROLE_PERMISSIONS).filter((n) => n !== roleName);
  const others = await prisma.role.findMany({
    where: { name: { in: otherNames } },
    select: { id: true },
  });
  if (others.length) {
    await prisma.userRoleAssignment.deleteMany({
      where: { userId, roleId: { in: others.map((r) => r.id) } },
    });
  }

  await prisma.userRoleAssignment.upsert({
    where: { userId_roleId: { userId, roleId: role.id } },
    create: { userId, roleId: role.id },
    update: {},
  });
}
