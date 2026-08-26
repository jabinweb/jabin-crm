import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

const DELIVERY_TASK_INCLUDE = {
  project: { select: { id: true, name: true } },
  assignee: { select: { id: true, name: true, email: true, image: true } },
  parentTask: { select: { id: true, title: true } },
} as const;

export type BacklogFilters = {
  projectId?: string | null;
  assignee?: 'all' | 'unassigned' | 'me' | string;
  status?: string | null;
  includeDone?: boolean;
  /** When true, include subtasks (My work). Backlog defaults to top-level only. */
  includeSubtasks?: boolean;
  userId?: string;
  take?: number | null;
  orderBy?: Prisma.ProjectTaskOrderByWithRelationInput[];
};

function buildDeliveryTaskWhere(
  companyId: string,
  filters: BacklogFilters = {}
): Prisma.ProjectTaskWhereInput {
  const where: Prisma.ProjectTaskWhereInput = {
    project: { companyId },
  };

  if (!filters.includeSubtasks) {
    where.parentTaskId = null;
  }

  if (filters.status) {
    where.status = filters.status;
  } else if (!filters.includeDone) {
    where.status = { not: 'DONE' };
  }

  if (filters.projectId) {
    where.projectId = filters.projectId;
  }

  if (filters.assignee === 'unassigned') {
    where.assigneeId = null;
  } else if (filters.assignee === 'me' && filters.userId) {
    where.assigneeId = filters.userId;
  } else if (
    filters.assignee &&
    filters.assignee !== 'all' &&
    filters.assignee !== 'me' &&
    filters.assignee !== 'unassigned'
  ) {
    where.assigneeId = filters.assignee;
  }

  return where;
}

export async function fetchCompanyBacklog(
  companyId: string,
  filters: BacklogFilters = {}
) {
  return prisma.projectTask.findMany({
    where: buildDeliveryTaskWhere(companyId, filters),
    include: DELIVERY_TASK_INCLUDE,
    orderBy: filters.orderBy ?? [
      { priority: 'desc' },
      { dueDate: 'asc' },
      { updatedAt: 'desc' },
    ],
    ...(filters.take === null
      ? {}
      : { take: filters.take ?? 200 }),
  });
}

/** Personal open delivery queue — same filter builder as backlog. */
export async function fetchMyProjectTasks(userId: string, companyId: string) {
  return fetchCompanyBacklog(companyId, {
    assignee: 'me',
    userId,
    includeSubtasks: true,
    take: null,
    orderBy: [{ dueDate: 'asc' }, { updatedAt: 'desc' }],
  });
}
