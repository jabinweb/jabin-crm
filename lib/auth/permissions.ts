import { prisma } from "@/lib/prisma";
import type { Session } from "next-auth";
import { syncUserRoleAssignment } from "@/lib/auth/rbac-catalog";

/**
 * Permission checks: legacy User.role enum + RBAC Role/Permission tables.
 */

export async function hasPermission(
  userId: string,
  permissionName: string
): Promise<boolean> {
  const match = await prisma.userRoleAssignment.findFirst({
    where: {
      userId,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      role: {
        permissions: {
          some: {
            permission: { name: permissionName },
          },
        },
      },
    },
    select: { id: true },
  });
  return !!match;
}

export function hasLegacyRole(session: Session | null, ...roles: string[]): boolean {
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!role) return false;
  return roles.includes(role);
}

/** Prefer RBAC; fall back to legacy role list when no assignments exist. */
export async function hasPermissionOrRole(
  session: Session | null,
  permissionName: string,
  ...legacyRoles: string[]
): Promise<boolean> {
  if (!session?.user?.id) return false;
  if (hasLegacyRole(session, "SUPER_ADMIN")) return true;

  const assigned = await prisma.userRoleAssignment.count({
    where: { userId: session.user.id },
  });
  if (assigned > 0) {
    return hasPermission(session.user.id, permissionName);
  }
  return hasLegacyRole(session, ...legacyRoles);
}

export async function requirePermission(
  session: Session | null,
  permissionName: string
): Promise<void> {
  const userId = session?.user?.id;
  if (!userId) {
    throw new Error("Unauthorized");
  }

  if (hasLegacyRole(session, "SUPER_ADMIN")) return;

  // Lazy-sync enum role into RBAC so permissions start working for existing users
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role) {
    await syncUserRoleAssignment(userId, role).catch(() => null);
  }

  const allowed = await hasPermission(userId, permissionName);
  if (!allowed && role) {
    // Temporary bridge while catalog seeds catch up
    const elevated = ["ADMIN", "SUPER_ADMIN"].includes(role);
    if (elevated) return;
  }
  if (!allowed) {
    throw new Error("Forbidden");
  }
}
