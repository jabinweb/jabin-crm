'use client';

import {
  AlertTriangle,
  CalendarDays,
  ChevronDown,
  ChevronsUp,
  ChevronUp,
  Equal,
} from 'lucide-react';
import { avatarTint } from '@/lib/avatar';
import { cn } from '@/lib/utils';

/**
 * The Jira-style task vocabulary shared by the project board, My work and the
 * Backlog: priority icons, due dates that turn red when late, project marks.
 */

export const PRIORITY_LABEL: Record<string, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
};

/** Higher = more pressing; used to sort rows Urgent → Low. */
export const PRIORITY_RANK: Record<string, number> = {
  URGENT: 3,
  HIGH: 2,
  MEDIUM: 1,
  LOW: 0,
};

const PRIORITY_ICON: Record<string, { Icon: typeof ChevronUp; className: string }> = {
  URGENT: { Icon: ChevronsUp, className: 'text-destructive' },
  HIGH: { Icon: ChevronUp, className: 'text-orange-500' },
  MEDIUM: { Icon: Equal, className: 'text-amber-500' },
  LOW: { Icon: ChevronDown, className: 'text-sky-500' },
};

export function PriorityIcon({
  priority,
  className,
}: {
  priority: string;
  className?: string;
}) {
  const meta = PRIORITY_ICON[priority] ?? PRIORITY_ICON.MEDIUM;
  const label = `${PRIORITY_LABEL[priority] ?? priority} priority`;
  return (
    <span title={label} aria-label={label} className="inline-flex shrink-0">
      <meta.Icon className={cn('h-4 w-4', meta.className, className)} aria-hidden />
    </span>
  );
}

/**
 * Due dates are calendar days: read the date part so a midnight-UTC value
 * doesn't shift a day in timezones west of UTC.
 */
export function parseDueDate(value?: string | null): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

export function isOverdue(dueDate: string | null | undefined, done: boolean) {
  if (done) return false;
  const due = parseDueDate(dueDate);
  return !!due && due < startOfToday();
}

export function formatDue(value?: string | null) {
  const due = parseDueDate(value);
  if (!due) return null;
  const sameYear = due.getFullYear() === new Date().getFullYear();
  return due.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

/** Calendar icon + date; red with a warning when the task is late. */
export function DueDate({
  value,
  done = false,
  className,
}: {
  value?: string | null;
  done?: boolean;
  className?: string;
}) {
  const label = formatDue(value);
  if (!label) return null;
  const overdue = isOverdue(value, done);
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-xs tabular-nums',
        overdue ? 'font-medium text-destructive' : 'text-muted-foreground',
        className
      )}
      title={overdue ? `Overdue — was due ${label}` : `Due ${label}`}
    >
      <CalendarDays className="h-3.5 w-3.5" aria-hidden />
      {label}
      {overdue ? <AlertTriangle className="h-3.5 w-3.5" aria-label="Overdue" /> : null}
    </span>
  );
}

/** Two-letter project mark (Jira shows a project avatar + key). */
export function projectInitials(name: string) {
  const words = name
    .split(/[\s\-–—_/.,:;&+|()[\]]+/)
    .filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}

export function ProjectMark({
  project,
  className,
}: {
  project: { id: string; name: string };
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-[9px] font-semibold',
        avatarTint(project.id),
        className
      )}
    >
      {projectInitials(project.name)}
    </span>
  );
}
