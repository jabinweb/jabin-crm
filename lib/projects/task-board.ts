import type { PipelineStageDef } from '@/lib/pipelines';

/** Kanban columns for project delivery tasks (Jira / ClickUp style). */
export const PROJECT_TASK_COLUMNS: PipelineStageDef[] = [
  { id: 'BACKLOG', label: 'Backlog', color: 'bg-slate-400' },
  { id: 'TODO', label: 'To do', color: 'bg-sky-500' },
  { id: 'IN_PROGRESS', label: 'In progress', color: 'bg-amber-500' },
  { id: 'IN_REVIEW', label: 'In review', color: 'bg-violet-500' },
  { id: 'DONE', label: 'Done', color: 'bg-emerald-500' },
];

export const PROJECT_TASK_STATUSES = PROJECT_TASK_COLUMNS.map((c) => c.id);

export const PROJECT_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;

export type ProjectTaskPriority = (typeof PROJECT_PRIORITIES)[number];

export function computeProgressFromTasks(
  tasks: Array<{ status: string }>,
  doneStatusIds: string[] = ['DONE']
): number {
  if (!tasks.length) return 0;
  const doneSet = new Set(doneStatusIds.length ? doneStatusIds : ['DONE']);
  const done = tasks.filter((t) => doneSet.has(t.status)).length;
  return Math.round((done / tasks.length) * 100);
}

/** Hub board: project status columns */
export const PROJECT_HUB_COLUMNS: PipelineStageDef[] = [
  { id: 'ACTIVE', label: 'Active', color: 'bg-emerald-500' },
  { id: 'ON_HOLD', label: 'On hold', color: 'bg-amber-500' },
  { id: 'COMPLETED', label: 'Completed', color: 'bg-blue-500' },
  { id: 'CANCELLED', label: 'Cancelled', color: 'bg-slate-400' },
];
