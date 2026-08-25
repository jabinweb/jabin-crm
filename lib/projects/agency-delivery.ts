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

export const PROJECT_INCLUDE = {
  customer: { select: { id: true, organizationName: true } },
  deal: { select: { id: true, title: true, stage: true, value: true } },
  pmUser: { select: { id: true, name: true, email: true } },
  milestones: { orderBy: { sortOrder: 'asc' as const } },
  tasks: {
    include: {
      assignee: { select: { id: true, name: true, email: true, image: true } },
    },
    orderBy: [{ status: 'asc' as const }, { sortOrder: 'asc' as const }],
  },
  members: {
    include: {
      user: { select: { id: true, name: true, email: true } },
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
