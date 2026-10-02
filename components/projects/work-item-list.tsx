'use client';

import { forwardRef, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import {
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FolderKanban,
  ListTodo,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Search,
  UserMinus,
  UserPlus,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { UserAvatar } from '@/components/ui/user-avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PROJECT_PRIORITIES } from '@/lib/projects/task-board';
import {
  resolveDoneStatusIds,
  resolveProjectTaskColumns,
} from '@/lib/projects/task-statuses';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { cn } from '@/lib/utils';
import {
  DueDate,
  PRIORITY_LABEL,
  PRIORITY_RANK,
  PriorityIcon,
  ProjectMark,
  parseDueDate,
} from '@/components/projects/task-meta';

/** A project task as the cross-project lists (My work, Backlog) receive it. */
export type WorkItem = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  updatedAt?: string;
  assigneeId?: string | null;
  project: { id: string; name: string };
  assignee?: {
    id: string;
    name: string | null;
    email: string | null;
    image?: string | null;
  } | null;
  parentTask?: { id: string; title: string } | null;
  labels?: Array<{ label: { id: string; name: string; color?: string } }>;
  _count?: { subtasks?: number; comments?: number };
};

export type StatusDef = { id: string; label: string; color: string };

/** Underline tabs — the same look as the project page's Board / List / Overview. */
export const WORK_TAB_CLASS =
  '-mb-px gap-1.5 rounded-none border-b-2 border-transparent px-0.5 pb-2 pt-1 text-sm font-medium normal-case tracking-normal text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground';

/** A per-viewer view preference (e.g. "group by") remembered in this browser. */
export function useStoredChoice<T extends string>(
  key: string,
  fallback: T,
  allowed: readonly T[]
): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(fallback);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(key) as T | null;
      if (saved && allowed.includes(saved)) setValue(saved);
    } catch {
      /* storage blocked: keep the default */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const set = (v: T) => {
    setValue(v);
    try {
      window.localStorage.setItem(key, v);
    } catch {
      /* ignore */
    }
  };
  return [value, set];
}

/* ------------------------------------------------------------------ statuses */

const DEFAULT_STATUSES = resolveProjectTaskColumns() as StatusDef[];
const DEFAULT_DONE = resolveDoneStatusIds();

/** Workspace task statuses (custom or default) — defaults render until loaded. */
export function useTaskStatuses() {
  const { slug, workspaceFetch } = useWorkspacePaths();
  const { data } = useQuery({
    queryKey: ['project-task-statuses', slug],
    queryFn: async () => {
      const res = await workspaceFetch('/api/projects/task-statuses');
      if (!res.ok) throw new Error('Failed to load statuses');
      return res.json() as Promise<{ statuses: StatusDef[]; doneStatusIds: string[] }>;
    },
    staleTime: 5 * 60_000,
  });
  return useMemo(() => {
    const statuses = data?.statuses?.length ? data.statuses : DEFAULT_STATUSES;
    const doneStatusIds = data?.doneStatusIds?.length ? data.doneStatusIds : DEFAULT_DONE;
    const statusById = new Map(statuses.map((s) => [s.id, s]));
    return { statuses, doneStatusIds, statusById };
  }, [data]);
}

export function statusMeta(statusById: Map<string, StatusDef>, id: string): StatusDef {
  return (
    statusById.get(id) ?? {
      id,
      label: id.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()),
      color: 'bg-slate-400',
    }
  );
}

/* ------------------------------------------------------------------- sorting */

/** Urgent first, then soonest due (undated last), then most recently touched. */
export function sortWorkItems<T extends WorkItem>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const p = (PRIORITY_RANK[b.priority] ?? 1) - (PRIORITY_RANK[a.priority] ?? 1);
    if (p !== 0) return p;
    const da = parseDueDate(a.dueDate)?.getTime() ?? Number.POSITIVE_INFINITY;
    const db = parseDueDate(b.dueDate)?.getTime() ?? Number.POSITIVE_INFINITY;
    if (da !== db) return da - db;
    return (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '');
  });
}

/* ------------------------------------------------------------------- writes */

type Person = NonNullable<WorkItem['assignee']>;

/**
 * Inline edits from a list row. Goes through the project tasks PATCH (and so
 * `updateProjectTask`), updates the row optimistically and rolls back on error.
 */
export function useWorkItemActions(
  queryKey: QueryKey,
  statusById: Map<string, StatusDef>
) {
  const { slug, workspaceFetch } = useWorkspacePaths();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({
      task,
      body,
    }: {
      task: WorkItem;
      body: Record<string, unknown>;
      optimistic: Partial<WorkItem>;
    }) => {
      const res = await workspaceFetch(`/api/projects/${task.project.id}/tasks`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: task.id, ...body }),
      });
      if (res.status === 401 || res.status === 403) {
        throw new Error(`You don't have edit access to ${task.project.name}`);
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Could not update the task');
      }
      return res.json();
    },
    onMutate: async ({ task, optimistic }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<WorkItem[]>(queryKey);
      queryClient.setQueryData<WorkItem[]>(queryKey, (list) =>
        list?.map((t) => (t.id === task.id ? { ...t, ...optimistic } : t))
      );
      return { previous };
    },
    onError: (e: Error, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(queryKey, ctx.previous);
      toast.error(e.message);
    },
    onSettled: (_data, _err, { task }) => {
      void queryClient.invalidateQueries({ queryKey });
      void queryClient.invalidateQueries({ queryKey: ['project', slug, task.project.id] });
      void queryClient.invalidateQueries({ queryKey: ['projects', slug] });
    },
  });

  const update = (task: WorkItem, body: Record<string, unknown>, optimistic: Partial<WorkItem>) =>
    mutation.mutateAsync({ task, body, optimistic });

  return {
    setStatus: (task: WorkItem, status: string) => {
      if (status === task.status) return;
      const from = task.status;
      update(task, { status }, { status })
        .then(() => {
          toast.success(`Moved to ${statusMeta(statusById, status).label}`, {
            description: task.title,
            action: {
              label: 'Undo',
              onClick: () => {
                void update({ ...task, status }, { status: from }, { status: from }).catch(() => {});
              },
            },
          });
        })
        .catch(() => {});
    },
    setPriority: (task: WorkItem, priority: string) => {
      if (priority === task.priority) return;
      void update(task, { priority }, { priority }).catch(() => {});
    },
    setAssignee: (task: WorkItem, person: Person | null) => {
      void update(
        task,
        { assigneeId: person?.id ?? null },
        { assigneeId: person?.id ?? null, assignee: person }
      )
        .then(() => toast.success(person ? 'Assigned to you' : 'Unassigned'))
        .catch(() => {});
    },
  };
}

export type WorkItemActions = ReturnType<typeof useWorkItemActions>;

/* ---------------------------------------------------------------- toolbar */

/** Search box; `/` focuses it from anywhere on the page (Jira's shortcut). */
export const WorkSearchInput = forwardRef<
  HTMLInputElement,
  { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }
>(function WorkSearchInput({ value, onChange, placeholder = 'Search', className }, ref) {
  const innerRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      e.preventDefault();
      innerRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <div className={cn('relative w-full sm:w-60', className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={(node) => {
          innerRef.current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref) ref.current = node;
        }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            onChange('');
            e.currentTarget.blur();
          }
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-9 pl-9 pr-8"
      />
      <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground sm:block">
        /
      </kbd>
    </div>
  );
});

export function PriorityFilter({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-[150px]" aria-label="Filter by priority">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectItem value="all">All priorities</SelectItem>
          {[...PROJECT_PRIORITIES].reverse().map((p) => (
            <SelectItem key={p} value={p}>
              <span className="inline-flex items-center gap-2">
                <PriorityIcon priority={p} />
                {PRIORITY_LABEL[p] ?? p}
              </span>
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

/* ---------------------------------------------------------------- sections */

export function WorkSection({
  title,
  count,
  leading,
  trailing,
  collapsed,
  onToggle,
  tone,
  children,
  footer,
}: {
  title: ReactNode;
  count: number;
  leading?: ReactNode;
  trailing?: ReactNode;
  collapsed: boolean;
  onToggle: () => void;
  /** `danger` tints the header (Overdue). */
  tone?: 'danger';
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="min-w-0 overflow-hidden rounded-lg border bg-card">
      <header
        className={cn(
          'flex min-h-10 items-center gap-2 bg-muted/40 pr-2',
          !collapsed && 'border-b'
        )}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          className="flex min-w-0 flex-1 items-center gap-2 self-stretch rounded-t-lg py-2 pl-2.5 text-left text-sm font-medium outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          <ChevronRight
            className={cn(
              'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
              !collapsed && 'rotate-90'
            )}
            aria-hidden
          />
          {leading}
          <span className={cn('min-w-0 truncate', tone === 'danger' && 'text-destructive')}>
            {title}
          </span>
          <span
            className={cn(
              'shrink-0 rounded-full px-1.5 py-px text-xs tabular-nums',
              tone === 'danger'
                ? 'bg-destructive/10 text-destructive'
                : 'bg-muted text-muted-foreground'
            )}
          >
            {count}
          </span>
        </button>
        {trailing}
      </header>
      {collapsed ? null : (
        <>
          <ul role="list" className="divide-y">
            {children}
          </ul>
          {footer ? <div className="border-t">{footer}</div> : null}
        </>
      )}
    </section>
  );
}

/** Segmented bar of how a group's tasks split across statuses. */
export function StatusBreakdown({
  tasks,
  statuses,
  className,
}: {
  tasks: WorkItem[];
  statuses: StatusDef[];
  className?: string;
}) {
  const counts = statuses
    .map((s) => ({ ...s, n: tasks.filter((t) => t.status === s.id).length }))
    .filter((s) => s.n > 0);
  if (counts.length === 0) return null;
  const summary = counts.map((s) => `${s.n} ${s.label.toLowerCase()}`).join(' · ');
  return (
    <div
      className={cn('flex h-1.5 w-24 overflow-hidden rounded-full bg-muted', className)}
      title={summary}
      aria-label={summary}
      role="img"
    >
      {counts.map((s) => (
        <span key={s.id} className={cn('h-full', s.color)} style={{ width: `${(s.n / tasks.length) * 100}%` }} />
      ))}
    </div>
  );
}

/* --------------------------------------------------------------------- rows */

function StatusMenu({
  task,
  statuses,
  statusById,
  onChange,
}: {
  task: WorkItem;
  statuses: StatusDef[];
  statusById: Map<string, StatusDef>;
  onChange: (status: string) => void;
}) {
  const current = statusMeta(statusById, task.status);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-7 max-w-[8.5rem] shrink-0 items-center gap-1.5 sm:w-[8.5rem] rounded-md border bg-background px-2 text-xs font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Status: ${current.label}. Change status`}
        >
          <span className={cn('h-2 w-2 shrink-0 rounded-full', current.color)} aria-hidden />
          <span className="min-w-0 truncate">{current.label}</span>
          <ChevronDown className="ml-auto hidden h-3 w-3 shrink-0 opacity-60 sm:block" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Move to
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup value={task.status} onValueChange={onChange}>
          {statuses.map((s) => (
            <DropdownMenuRadioItem key={s.id} value={s.id} className="gap-2">
              <span className={cn('h-2 w-2 shrink-0 rounded-full', s.color)} aria-hidden />
              {s.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function RowMenu({
  task,
  href,
  projectHref,
  actions,
}: {
  task: WorkItem;
  href: string;
  projectHref: string;
  actions: WorkItemActions;
}) {
  const { data: session } = useSession();
  const me = session?.user;
  const mine = !!me?.id && task.assignee?.id === me.id;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground sm:h-7 sm:w-7 sm:opacity-0 sm:focus-visible:opacity-100 sm:group-hover:opacity-100 sm:data-[state=open]:opacity-100"
        >
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Task actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem asChild>
          <Link href={href}>
            <ExternalLink className="mr-2 h-4 w-4" />
            Open task
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={projectHref}>
            <FolderKanban className="mr-2 h-4 w-4" />
            Open project board
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <PriorityIcon priority={task.priority} className="mr-2" />
            Priority
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-40">
            {[...PROJECT_PRIORITIES].reverse().map((p) => (
              <DropdownMenuItem key={p} onClick={() => actions.setPriority(task, p)}>
                <PriorityIcon priority={p} className="mr-2" />
                {PRIORITY_LABEL[p] ?? p}
                {task.priority === p ? <Check className="ml-auto h-4 w-4" /> : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        {me?.id && !mine ? (
          <DropdownMenuItem
            onClick={() =>
              actions.setAssignee(task, {
                id: me.id,
                name: me.name ?? null,
                email: me.email ?? null,
                image: me.image ?? null,
              })
            }
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Assign to me
          </DropdownMenuItem>
        ) : null}
        {task.assignee ? (
          <DropdownMenuItem onClick={() => actions.setAssignee(task, null)}>
            <UserMinus className="mr-2 h-4 w-4" />
            Unassign
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * One dense, Jira-style row. Desktop: a single line with fixed-width columns on
 * the right. Phone: title (+ assignee, menu) on top, project · due · status below. The whole row opens
 * the task (stretched link); the status pill and menu sit above it.
 */
export function WorkItemRow({
  task,
  statuses,
  statusById,
  doneStatusIds,
  actions,
  showProject = true,
  showAssignee = false,
}: {
  task: WorkItem;
  statuses: StatusDef[];
  statusById: Map<string, StatusDef>;
  doneStatusIds: string[];
  actions: WorkItemActions;
  showProject?: boolean;
  showAssignee?: boolean;
}) {
  const { path } = useWorkspacePaths();
  const href = path(`/dashboard/projects/${task.project.id}/tasks/${task.id}`);
  const projectHref = path(`/dashboard/projects/${task.project.id}`);
  const done = doneStatusIds.includes(task.status);
  const labels = task.labels ?? [];
  const subtasks = task._count?.subtasks ?? 0;
  const comments = task._count?.comments ?? 0;

  const trailing = (
    <>
      {showAssignee ? (
        task.assignee ? (
          <span title={task.assignee.name || task.assignee.email || ''} className="inline-flex">
            <UserAvatar person={task.assignee} size="sm" />
          </span>
        ) : (
          <span
            title="Unassigned"
            aria-label="Unassigned"
            className="inline-block h-7 w-7 shrink-0 rounded-full border border-dashed border-muted-foreground/40"
          />
        )
      ) : null}
      <RowMenu task={task} href={href} projectHref={projectHref} actions={actions} />
    </>
  );

  return (
    <li className="group relative flex flex-col gap-1.5 px-3 py-2.5 transition-colors focus-within:bg-muted/40 hover:bg-muted/40 sm:flex-row sm:items-center sm:gap-3 sm:py-1.5">
      <div className="flex min-w-0 flex-1 items-start gap-2.5 sm:items-center">
        <PriorityIcon priority={task.priority} className="mt-0.5 sm:mt-0" />
        <div className="min-w-0 flex-1">
          <Link
            href={href}
            className={cn(
              'line-clamp-2 text-sm font-medium leading-snug outline-none after:absolute after:inset-0 hover:underline focus-visible:underline sm:line-clamp-1',
              done && 'text-muted-foreground line-through decoration-muted-foreground/50'
            )}
          >
            {task.title}
          </Link>
          {task.parentTask ? (
            <p className="truncate text-xs text-muted-foreground">
              Subtask of {task.parentTask.title}
            </p>
          ) : null}
        </div>
        {labels.length > 0 ? (
          <div className="hidden shrink-0 items-center gap-1 lg:flex">
            {labels.slice(0, 2).map((l) => (
              <span
                key={l.label.id}
                className="max-w-[7rem] truncate rounded border px-1.5 py-px text-[10px] text-muted-foreground"
              >
                {l.label.name}
              </span>
            ))}
            {labels.length > 2 ? (
              <span className="text-[10px] text-muted-foreground">+{labels.length - 2}</span>
            ) : null}
          </div>
        ) : null}
        {subtasks > 0 || comments > 0 ? (
          <div className="hidden shrink-0 items-center gap-2 text-xs text-muted-foreground sm:flex">
            {subtasks > 0 ? (
              <span className="inline-flex items-center gap-0.5" title={`${subtasks} subtasks`}>
                <ListTodo className="h-3.5 w-3.5" aria-hidden />
                {subtasks}
              </span>
            ) : null}
            {comments > 0 ? (
              <span className="inline-flex items-center gap-0.5" title={`${comments} comments`}>
                <MessageSquare className="h-3.5 w-3.5" aria-hidden />
                {comments}
              </span>
            ) : null}
          </div>
        ) : null}
        {/* Phones: assignee + menu ride on the title line */}
        <div className="relative z-10 -my-1 flex shrink-0 items-center gap-1 sm:hidden">
          {trailing}
        </div>
      </div>

      <div className="relative z-10 flex min-w-0 items-center gap-2 pl-[26px] sm:gap-3 sm:pl-0">
        {showProject ? (
          <Link
            href={projectHref}
            className="inline-flex min-w-0 flex-1 items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:underline sm:w-44 sm:flex-none"
            title={task.project.name}
          >
            <ProjectMark project={task.project} className="h-4 w-4 text-[8px]" />
            <span className="truncate">{task.project.name}</span>
          </Link>
        ) : null}
        <span className={cn('shrink-0 sm:w-24', !showProject && 'flex-1 sm:flex-none')}>
          <DueDate value={task.dueDate} done={done} />
        </span>
        <StatusMenu
          task={task}
          statuses={statuses}
          statusById={statusById}
          onChange={(s) => actions.setStatus(task, s)}
        />
        <div className="hidden items-center gap-2 sm:flex">{trailing}</div>
      </div>
    </li>
  );
}

/* ------------------------------------------------------------- quick create */

/**
 * Jira's inline "+ Create" row: type a title, Enter creates, the row stays open
 * for the next one, Esc closes. Without a fixed project it shows a picker.
 */
export function QuickCreateRow({
  projectId: fixedProjectId,
  projects = [],
  onCreated,
  defaultOpen = false,
  onCancel,
  className,
}: {
  projectId?: string;
  projects?: Array<{ id: string; name: string }>;
  onCreated?: (projectId: string) => void;
  defaultOpen?: boolean;
  onCancel?: () => void;
  className?: string;
}) {
  const router = useRouter();
  const { workspaceFetch, path } = useWorkspacePaths();
  const [open, setOpen] = useState(defaultOpen);
  const [title, setTitle] = useState('');
  const [pickedProject, setPickedProject] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const projectId = fixedProjectId ?? (pickedProject || projects[0]?.id || '');
  const projectName =
    projects.find((p) => p.id === projectId)?.name ?? 'this project';

  const create = useMutation({
    mutationFn: async () => {
      const res = await workspaceFetch(`/api/projects/${projectId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim() }),
      });
      if (res.status === 401 || res.status === 403) {
        throw new Error(`You can't add tasks to ${projectName}`);
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Could not create the task');
      }
      return res.json() as Promise<{ task: { id: string; title: string } }>;
    },
    onSuccess: ({ task }) => {
      setTitle('');
      toast.success('Task created', {
        description: task.title,
        action: {
          label: 'Open',
          onClick: () => router.push(path(`/dashboard/projects/${projectId}/tasks/${task.id}`)),
        },
      });
      onCreated?.(projectId);
      inputRef.current?.focus();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground focus-visible:bg-muted/40 focus-visible:outline-none',
          className
        )}
      >
        <Plus className="h-4 w-4" aria-hidden />
        Create task
      </button>
    );
  }

  const close = () => {
    setOpen(false);
    setTitle('');
    onCancel?.();
  };

  return (
    <form
      className={cn('flex flex-col gap-2 p-2 sm:flex-row sm:items-center', className)}
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim() || !projectId || create.isPending) return;
        create.mutate();
      }}
    >
      {fixedProjectId ? null : (
        <Select value={projectId} onValueChange={setPickedProject}>
          <SelectTrigger className="h-9 w-full sm:w-48" aria-label="Project">
            <SelectValue placeholder="Choose a project" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      )}
      <Input
        ref={inputRef}
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') close();
        }}
        placeholder="What needs to be done?"
        aria-label="New task title"
        className="h-9 min-w-0 flex-1"
      />
      <div className="flex items-center gap-2">
        <Button
          type="submit"
          size="sm"
          className="h-9 flex-1 sm:flex-none"
          disabled={!title.trim() || !projectId || create.isPending}
        >
          {create.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
          Create
        </Button>
        <Button type="button" size="sm" variant="ghost" className="h-9" onClick={close}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ loading */

/** Skeleton for the list area only — headings and toolbars render as-is. */
export function WorkListSkeleton({ sections = 2, rows = 4 }: { sections?: number; rows?: number }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      {Array.from({ length: sections }, (_, s) => (
        <div key={s} className="overflow-hidden rounded-lg border">
          <div className="flex h-10 items-center gap-2 border-b bg-muted/40 px-3">
            <Skeleton className="h-3.5 w-3.5 rounded" />
            <Skeleton className="h-3.5 w-28 rounded" />
            <Skeleton className="h-3.5 w-6 rounded-full" />
          </div>
          <div className="divide-y">
            {Array.from({ length: rows }, (_, r) => (
              <div key={r} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3">
                <div className="flex flex-1 items-center gap-2.5">
                  <Skeleton className="h-4 w-4 rounded" />
                  <Skeleton className={cn('h-3.5 rounded', r % 2 ? 'w-2/3' : 'w-1/2')} />
                </div>
                <div className="flex items-center gap-3 pl-[26px] sm:pl-0">
                  <Skeleton className="h-3.5 w-28 rounded sm:w-40" />
                  <Skeleton className="h-3.5 w-14 rounded" />
                  <Skeleton className="ml-auto h-7 w-[8.5rem] rounded-md sm:ml-0" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
