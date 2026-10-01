import { prisma } from '@/lib/prisma';

/**
 * Prisma `where` for staff users of a workspace: anyone with a membership row, plus
 * legacy users who only have `companyId` / `primaryCompanyId` set. Customers excluded.
 */
export function workspaceStaffWhere(companyId: string) {
  return {
    role: { not: 'CUSTOMER' as const },
    OR: [
      { companyId },
      { primaryCompanyId: companyId },
      { userCompanies: { some: { companyId } } },
    ],
  };
}

export async function isWorkspaceStaff(companyId: string, userId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, ...workspaceStaffWhere(companyId) },
    select: { id: true },
  });
  return !!user;
}
