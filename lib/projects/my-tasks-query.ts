import { prisma } from '@/lib/prisma';

export async function fetchMyProjectTasks(userId: string, companyId: string) {
  return prisma.projectTask.findMany({
    where: {
      assigneeId: userId,
      project: { companyId },
    },
    include: {
      project: { select: { id: true, name: true } },
      assignee: { select: { id: true, name: true, email: true, image: true } },
      parentTask: { select: { id: true, title: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });
}
