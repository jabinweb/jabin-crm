import type { PipelineStageDef } from '@/lib/pipelines';
import { PROJECT_TASK_COLUMNS, PROJECT_TASK_STATUSES } from '@/lib/projects/task-board';

export type ProjectTaskStatusDef = {
  id: string;
  label: string;
  color?: string;
  order?: number;
  isDone?: boolean;
};

const DEFAULT_COLORS = [
  'bg-slate-400',
  'bg-sky-500',
  'bg-amber-500',
  'bg-violet-500',
  'bg-emerald-500',
  'bg-rose-500',
  'bg-cyan-500',
  'bg-orange-500',
];

function parseStatusList(settings?: unknown): ProjectTaskStatusDef[] {
  const raw =
    settings &&
    typeof settings === 'object' &&
    !Array.isArray(settings) &&
    'projectTaskStatuses' in settings
      ? (settings as { projectTaskStatuses?: unknown }).projectTaskStatuses
      : null;

  if (!Array.isArray(raw) || raw.length === 0) {
    return defaultProjectTaskStatuses();
  }

  const list: ProjectTaskStatusDef[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const id =
      typeof rec.id === 'string'
        ? rec.id.trim().toUpperCase().replace(/\s+/g, '_')
        : '';
    const label =
      typeof rec.label === 'string' && rec.label.trim()
        ? rec.label.trim()
        : id.replace(/_/g, ' ');
    if (!id) continue;
    list.push({
      id,
      label,
      color:
        typeof rec.color === 'string' && rec.color.trim()
          ? rec.color.trim()
          : DEFAULT_COLORS[i % DEFAULT_COLORS.length],
      order: typeof rec.order === 'number' ? rec.order : i,
      isDone: rec.isDone === true || id === 'DONE',
    });
  }

  if (list.length === 0) return defaultProjectTaskStatuses();
  return list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/** Resolve Kanban columns from Company.settings.projectTaskStatuses or defaults. */
export function resolveProjectTaskColumns(
  settings?: unknown
): PipelineStageDef[] {
  return parseStatusList(settings).map((s) => ({
    id: s.id,
    label: s.label,
    color: s.color || 'bg-slate-400',
  }));
}

export function resolveProjectTaskStatusIds(settings?: unknown): string[] {
  return resolveProjectTaskColumns(settings).map((c) => c.id);
}

/** Status IDs that count as complete for project progress. */
export function resolveDoneStatusIds(settings?: unknown): string[] {
  const list = parseStatusList(settings);
  const done = list.filter((s) => s.isDone).map((s) => s.id);
  return done.length > 0 ? done : ['DONE'];
}

export function isAllowedProjectTaskStatus(
  status: string,
  settings?: unknown
): boolean {
  const ids = resolveProjectTaskStatusIds(settings);
  if (ids.includes(status)) return true;
  return PROJECT_TASK_STATUSES.includes(status);
}

export function defaultProjectTaskStatuses(): ProjectTaskStatusDef[] {
  return PROJECT_TASK_COLUMNS.map((c, i) => ({
    id: c.id,
    label: c.label,
    color: c.color,
    order: i,
    isDone: c.id === 'DONE',
  }));
}
