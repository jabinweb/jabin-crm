import { prisma } from '@/lib/prisma';

export { extractMentionIds, newMentionIds } from '@/lib/projects/mention-html';

function companyStaffWhere(companyId: string) {
  return {
    role: { not: 'CUSTOMER' as const },
    OR: [
      { companyId },
      { primaryCompanyId: companyId },
      { userCompanies: { some: { companyId } } },
    ],
  };
}

/** Keep only ids that are staff users of this company (drops forged / cross-tenant ids). */
export async function filterCompanyStaffIds(
  companyId: string,
  userIds: string[]
): Promise<string[]> {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  if (unique.length === 0) return [];
  const users = await prisma.user.findMany({
    where: { id: { in: unique }, ...companyStaffWhere(companyId) },
    select: { id: true },
  });
  const allowed = new Set(users.map((u) => u.id));
  return unique.filter((id) => allowed.has(id));
}

export async function isCompanyStaff(companyId: string, userId: string) {
  return (await filterCompanyStaffIds(companyId, [userId])).length === 1;
}

/** People who can be @mentioned / assigned in a project: project team first, then the rest of the workspace. */
export async function listMentionableUsers(companyId: string, projectId: string) {
  const [project, staff] = await Promise.all([
    prisma.project.findFirst({
      where: { id: projectId, companyId },
      select: {
        pmUserId: true,
        members: { select: { userId: true } },
      },
    }),
    prisma.user.findMany({
      where: { userStatus: 'ACTIVE', ...companyStaffWhere(companyId) },
      select: { id: true, name: true, email: true, image: true },
      orderBy: { name: 'asc' },
      take: 200,
    }),
  ]);
  if (!project) return null;

  const team = new Set<string>([
    ...(project.pmUserId ? [project.pmUserId] : []),
    ...project.members.map((m) => m.userId),
  ]);
  return staff
    .map((user) => ({ ...user, onProject: team.has(user.id) }))
    .sort((a, b) => Number(b.onProject) - Number(a.onProject));
}
