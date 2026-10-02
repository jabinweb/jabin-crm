import type { NextRequest } from 'next/server';
import type { Session } from 'next-auth';
import type { Prisma } from '@prisma/client';
import { auth } from '@/auth';
import { ApiErrors } from '@/lib/api-error-handler';
import { guardAgentFeature } from '@/lib/api/subscription-guards';
import { resolveCompanyContextFromRequest } from '@/lib/auth/company-membership';

/**
 * Roles that work the whole workspace's leads (Sales nav audience). Everyone else on
 * staff (e.g. technicians using the employee Leads module) works only their own leads.
 */
export const LEAD_MANAGER_ROLES = ['ADMIN', 'SUPER_ADMIN', 'SALES', 'SUPPORT_MANAGER'];

export type LeadAccessContext = {
  session: Session;
  userId: string;
  companyId: string;
  employeeId?: string;
  role?: string;
  isManager: boolean;
};

/** Staff session + workspace + LEADS plan module. Portal customers are refused. */
export async function requireLeadAccess(request: NextRequest): Promise<LeadAccessContext> {
  const session = await auth();
  if (!session?.user?.id) throw ApiErrors.unauthorized();
  const role = (session.user as { role?: string }).role;
  if (role === 'CUSTOMER') throw ApiErrors.forbidden();

  const { companyId } = await resolveCompanyContextFromRequest(session, request);
  await guardAgentFeature(session.user as { id: string; role?: string }, 'LEADS', companyId);

  const employeeId =
    typeof session.user.employeeId === 'string' && session.user.employeeId
      ? session.user.employeeId
      : undefined;

  return {
    session,
    userId: session.user.id,
    companyId,
    employeeId,
    role,
    isManager: LEAD_MANAGER_ROLES.includes(String(role)),
  };
}

/** Leads the caller owns: created by, assigned to, or worked by their employee profile. */
export function ownLeadsWhere(ctx: Pick<LeadAccessContext, 'userId' | 'employeeId'>): Prisma.LeadWhereInput {
  return {
    OR: [
      { userId: ctx.userId },
      { assignedToId: ctx.userId },
      ...(ctx.employeeId ? [{ employeeId: ctx.employeeId }] : []),
    ],
  };
}

/** Leads the caller may open and act on: whole workspace for managers, own leads otherwise. */
export function leadAccessWhere(ctx: LeadAccessContext): Prisma.LeadWhereInput {
  if (ctx.isManager) return { companyId: ctx.companyId };
  return { companyId: ctx.companyId, ...ownLeadsWhere(ctx) };
}
