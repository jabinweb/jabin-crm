import type { Session } from 'next-auth';
import { prisma } from '@/lib/prisma';
import {
  hasLegacyRole,
  hasPermissionOrRole,
} from '@/lib/auth/permissions';

/** Can view project delivery (boards, tasks, my work). */
export async function canReadProjectDelivery(
  session: Session | null
): Promise<boolean> {
  if (!session?.user?.id) return false;
  if (
    hasLegacyRole(
      session,
      'SUPER_ADMIN',
      'ADMIN',
      'SALES',
      'SUPPORT_MANAGER',
      'TECHNICIAN'
    )
  ) {
    return true;
  }
  return hasPermissionOrRole(
    session,
    'projects:read',
    'ADMIN',
    'SALES',
    'SUPPORT_MANAGER',
    'TECHNICIAN'
  );
}

/**
 * Can mutate project delivery for a company / optional project.
 * Admins & sales: always. Others: projects:write + project member/PM (or any write if no projectId).
 */
export async function canWriteProjectDelivery(
  session: Session | null,
  companyId: string,
  projectId?: string
): Promise<boolean> {
  if (!session?.user?.id) return false;
  if (hasLegacyRole(session, 'SUPER_ADMIN', 'ADMIN', 'SALES')) {
    return true;
  }

  const allowed = await hasPermissionOrRole(
    session,
    'projects:write',
    'ADMIN',
    'SALES',
    'TECHNICIAN'
  );
  if (!allowed) return false;
  if (!projectId) return true;

  const access = await prisma.project.findFirst({
    where: {
      id: projectId,
      companyId,
      OR: [
        { pmUserId: session.user.id },
        { members: { some: { userId: session.user.id } } },
      ],
    },
    select: { id: true },
  });
  return !!access;
}
