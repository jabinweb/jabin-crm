import type { prisma } from '@/lib/prisma';
import { isWorkspaceStaff } from '@/lib/auth/workspace-staff';

/** Shared helpers for web-agency delivery projects. */

export const DEFAULT_MILESTONE_TEMPLATES = [
  { title: 'Discovery & brief', sortOrder: 0 },
  { title: 'Design / UX', sortOrder: 1 },
  { title: 'Build / development', sortOrder: 2 },
  { title: 'QA & revisions', sortOrder: 3 },
  { title: 'Launch', sortOrder: 4 },
] as const;

export function computeProgressFromMilestones(
  milestones: Array<{ status: string }>
): number {
  if (!milestones.length) return 0;
  const done = milestones.filter((m) => m.status === 'DONE').length;
  return Math.round((done / milestones.length) * 100);
}

export function nextBillDate(
  from: Date,
  cycle: 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | string
): Date {
  const d = new Date(from);
  if (cycle === 'QUARTERLY') d.setMonth(d.getMonth() + 3);
  else if (cycle === 'YEARLY') d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d;
}

/** Shared include for board / project-detail task lists (top-level cards). */
export const PROJECT_TASK_LIST_INCLUDE = {
  assignee: { select: { id: true, name: true, email: true, image: true } },
  _count: { select: { subtasks: true } },
} as const;

export const PROJECT_INCLUDE = {
  customer: { select: { id: true, organizationName: true } },
  deal: { select: { id: true, title: true, stage: true, value: true } },
  pmUser: { select: { id: true, name: true, email: true, image: true } },
  milestones: { orderBy: { sortOrder: 'asc' as const } },
  tasks: {
    where: { parentTaskId: null },
    include: PROJECT_TASK_LIST_INCLUDE,
    orderBy: [{ status: 'asc' as const }, { sortOrder: 'asc' as const }],
  },
  members: {
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
    },
  },
  retainers: {
    where: { status: { in: ['ACTIVE', 'PAUSED'] } },
    orderBy: { nextBillAt: 'asc' as const },
  },
  _count: {
    select: {
      tickets: true,
      timesheetEntries: true,
      tasks: true,
    },
  },
} as const;

/**
 * Customer / deal / PM picked for a project must belong to the same workspace —
 * otherwise another tenant's record would be linked and shown on the project.
 * Returns an error message, or null when every given id is valid.
 */
export async function invalidProjectLink(
  db: typeof prisma,
  companyId: string,
  links: { customerId?: string | null; dealId?: string | null; pmUserId?: string | null }
): Promise<string | null> {
  if (links.customerId) {
    const n = await db.customer.count({ where: { id: links.customerId, companyId } });
    if (!n) return 'Customer not found';
  }
  if (links.dealId) {
    const n = await db.deal.count({ where: { id: links.dealId, lead: { companyId } } });
    if (!n) return 'Deal not found';
  }
  if (links.pmUserId) {
    if (!(await isWorkspaceStaff(companyId, links.pmUserId))) return 'Project manager not found';
  }
  return null;
}
