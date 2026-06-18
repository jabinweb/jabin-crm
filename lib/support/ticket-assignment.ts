import { prisma } from '@/lib/prisma';

const AGENT_ROLES = ['TECHNICIAN', 'SUPPORT_MANAGER', 'ADMIN', 'SUPER_ADMIN'] as const;

export interface AssignmentOptions {
  companyId?: string | null;
  groupId?: string | null;
}

/**
 * Pick the least-busy support agent, preferring members of the ticket's group.
 */
export async function getNextAvailableAgent(options: AssignmentOptions = {}) {
  const { companyId, groupId } = options;

  let candidateUserIds: string[] | undefined;

  if (groupId) {
    const members = await prisma.supportGroupMember.findMany({
      where: { groupId },
      select: { userId: true },
    });
    const memberIds = members.map((m) => m.userId);
    if (memberIds.length > 0) {
      candidateUserIds = memberIds;
    }
  }

  const agents = await prisma.user.findMany({
    where: {
      role: { in: [...AGENT_ROLES] },
      userStatus: 'ACTIVE',
      ...(candidateUserIds ? { id: { in: candidateUserIds } } : {}),
      ...(companyId
        ? {
            OR: [
              { companyId },
              { primaryCompanyId: companyId },
              { userCompanies: { some: { companyId } } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      _count: {
        select: {
          assignedTickets: {
            where: { status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] } },
          },
        },
      },
    },
  });

  if (agents.length === 0 && groupId && candidateUserIds && candidateUserIds.length > 0) {
    return getNextAvailableAgent({ companyId, groupId: null });
  }

  if (agents.length === 0) return null;

  return agents.sort((a, b) => a._count.assignedTickets - b._count.assignedTickets)[0];
}
