import { prisma } from "@/lib/prisma";
import type { Session } from "next-auth";

/**
 * Permission checks are canonicalized here.
 *
 * Today we still have legacy checks based on `session.user.role` (enum) while RBAC
 * tables are being adopted. This module provides a single interface so callers
 * don’t need to know which system is authoritative yet.
 */

export type PermissionCheckContext = {
  userId: string;
};

export async function hasPermission(
  userId: string,
  permissionName: string
): Promise<boolean> {
  // RBAC: UserRoleAssignment -> RolePermission -> Permission
  const match = await prisma.userRoleAssignment.findFirst({
    where: {
      userId,
      role: {
        permissions: {
          some: {
            permission: {
              name: permissionName,
            },
          },
        },
      },
    },
    select: { id: true },
  });
  return !!match;
}

export function hasLegacyRole(session: Session | null, ...roles: string[]): boolean {
  const role = (session?.user as any)?.role as string | undefined;
  if (!role) return false;
  return roles.includes(role);
}

export async function requirePermission(
  session: Session | null,
  permissionName: string
): Promise<void> {
  const userId = session?.user?.id;
  if (!userId) {
    throw new Error("Unauthorized");
  }

  // Legacy shortcut: SUPER_ADMIN bypass.
  if (hasLegacyRole(session, "SUPER_ADMIN")) return;

  const allowed = await hasPermission(userId, permissionName);
  if (!allowed) {
    throw new Error("Forbidden");
  }
}

