'use client';

import { useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  PipelineBoard,
  buildBoardState,
  type PipelineBoardCard,
} from '@/components/pipelines/pipeline-board';
import { UNMAPPED_STAGE_ID, type PipelineStageDef } from '@/lib/pipelines';
import { PROJECT_PRIORITIES } from '@/lib/projects/task-board';
import { resolveDoneStatusIds, resolveProjectTaskColumns } from '@/lib/projects/task-statuses';
import { UserAvatar } from '@/components/ui/user-avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  ExternalLink,
  LayoutGrid,
  List,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  ListTodo,
  Search,
  CalendarDays,
  AlertTriangle,
  MessageSquare,
  ChevronsUp,
  ChevronUp,
  ChevronDown,
  Equal,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';

export type ProjectTaskRow = PipelineBoardCard & {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  dueDate?: string | null;
  sortOrder: number;
  assigneeId?: string | null;
  assignee?: {
    id: string;
    name: string | null;
    email: string | null;
    image?: string | null;
  } | null;
  _count?: { subtasks?: number; comments?: number };
  labels?: Array<{ label: { id: string; name: string; color?: string } }>;
};

export type ProjectMemberOption = {
  id: string;
  name: string | null;
  email: string | null;
};

const PRIORITY_CLASS: Record<string, string> = {
  LOW: 'border-border text-muted-foreground',
  MEDIUM: 'border-primary/30 text-foreground',
  HIGH: 'border-amber-500/40 text-amber-700 dark:text-amber-400',
  URGENT: 'border-destructive/40 text-destructive',
};

const PRIORITY_LABEL: Record<string, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
};

const PRIORITY_ICON: Record<string, { Icon: typeof ChevronUp; className: string }> = {
  URGENT: { Icon: ChevronsUp, className: 'text-destructive' },
  HIGH: { Icon: ChevronUp, className: 'text-orange-500' },
  MEDIUM: { Icon: Equal, className: 'text-amber-500' },
  LOW: { Icon: ChevronDown, className: 'text-sky-500' },
};

function PriorityIcon({ priority }: { priority: string }) {
  const meta = PRIORITY_ICON[priority] ?? PRIORITY_ICON.MEDIUM;
  const label = `${PRIORITY_LABEL[priority] ?? priority} priority`;
  return (
    <span title={label} aria-label={label} className="inline-flex">
      <meta.Icon className={cn('size-4', meta.className)} aria-hidden />
    </span>
  );
}

function isOverdue(dueDate: string | null | undefined, done: boolean) {
  if (!dueDate || done) return false;
  const due = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}

function formatDue(value?: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  });
}

function toDateInput(value?: string | null) {
  if (!value) return '';
  return value.slice(0, 10);
}

type TaskFormState = {
  title: string;
  description: string;
  status: string;
  priority: string;
  dueDate: string;
  assigneeId: string;
};

const emptyForm = (status = 'TODO'): TaskFormState => ({
  title: '',
  description: '',
  status,
  priority: 'MEDIUM',
  dueDate: '',
  assigneeId: '',
});

type Props = {
  projectId: string;
  tasks: ProjectTaskRow[];
  progress?: number;
  members?: ProjectMemberOption[];
  statusColumns?: PipelineStageDef[] | null;
  projectTaskStatuses?: unknown;
  /** Viewer can't change tasks (the task APIs would refuse) — hide edit controls. */
  readOnly?: boolean;
  /** Controlled view (the page's tabs); omit to show the board's own Board/List toggle. */
  view?: 'board' | 'list';
};

export function ProjectTaskBoard({
  projectId,
  tasks: initialTasks,
  members = [],
  statusColumns,
  projectTaskStatuses,
  readOnly = false,
  view: controlledView,
}: Props) {
  const { slug, workspaceFetch, path } = useWorkspacePaths();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const [ownView, setView] = useState<'board' | 'list'>('board');
  const view = controlledView ?? ownView;
  // Board filters (Jira-style): text, people, priority, "only my tasks"
  const [query, setQuery] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState<string[]>([]);
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [mineOnly, setMineOnly] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTask, setEditTask] = useState<ProjectTaskRow | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<TaskFormState>(emptyForm());

  const boardColumns = useMemo(() => {
    if (statusColumns && statusColumns.length > 0) return statusColumns;
    return resolveProjectTaskColumns(
      projectTaskStatuses ? { projectTaskStatuses } : undefined
    );
  }, [statusColumns, projectTaskStatuses]);

  const allTasks = useMemo(
    () => initialTasks.map((t) => ({ ...t, stage: t.status })),
    [initialTasks]
  );
  const doneStatusIds = useMemo(
    () => resolveDoneStatusIds(projectTaskStatuses ? { projectTaskStatuses } : undefined),
    [projectTaskStatuses]
  );

  const myId = session?.user?.id;
  const filtersActive =
    query.trim() !== '' || assigneeFilter.length > 0 || priorityFilter !== 'all' || mineOnly;
  const clearFilters = () => {
    setQuery('');
    setAssigneeFilter([]);
    setPriorityFilter('all');
    setMineOnly(false);
  };

  const tasks = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allTasks.filter((t) => {
      if (q && !t.title.toLowerCase().includes(q) &&
        !(t.labels ?? []).some((l) => l.label.name.toLowerCase().includes(q))) {
        return false;
      }
      if (mineOnly && t.assigneeId !== myId) return false;
      if (assigneeFilter.length > 0) {
        const key = t.assigneeId || '__none__';
        if (!assigneeFilter.includes(key)) return false;
      }
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
      return true;
    });
  }, [allTasks, query, mineOnly, myId, assigneeFilter, priorityFilter]);

  // People shown in the filter: the team plus anyone holding a task here
  const filterPeople = useMemo(() => {
    const byId = new Map<string, { id: string; name: string | null; email: string | null; image?: string | null }>();
    for (const m of members) byId.set(m.id, m);
    for (const t of allTasks) if (t.assignee) byId.set(t.assignee.id, t.assignee);
    return Array.from(byId.values());
  }, [members, allTasks]);
  const hasUnassigned = allTasks.some((t) => !t.assigneeId);

  const { columns, itemsByStage } = useMemo(
    () => buildBoardState(tasks, boardColumns),
    [tasks, boardColumns]
  );
  const { itemsByStage: allItemsByStage } = useMemo(
    () => buildBoardState(allTasks, boardColumns),
    [allTasks, boardColumns]
  );

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['project', slug, projectId] });
    void queryClient.invalidateQueries({ queryKey: ['projects', slug] });
  };

  const openCreate = (status = 'TODO') => {
    if (readOnly) return;
    setForm(emptyForm(status));
    setCreateOpen(true);
  };

  const openEdit = (task: ProjectTaskRow) => {
    if (readOnly) return;
    setEditTask(task);
    setForm({
      title: task.title,
      description: task.description || '',
      status: task.status,
      priority: task.priority,
      dueDate: toDateInput(task.dueDate),
      assigneeId: task.assigneeId || '',
    });
  };

  const taskHref = (taskId: string) =>
    path(`/dashboard/projects/${projectId}/tasks/${taskId}`);

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await workspaceFetch(`/api/projects/${projectId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim() || null,
          status: form.status,
          priority: form.priority,
          dueDate: form.dueDate || null,
          assigneeId: form.assigneeId || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create task');
      }
      return res.json();
    },
    onSuccess: () => {
      setCreateOpen(false);
      setForm(emptyForm());
      toast.success('Task added');
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editTask) return;
      const res = await workspaceFetch(`/api/projects/${projectId}/tasks`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editTask.id,
          title: form.title.trim(),
          description: form.description.trim() || null,
          status: form.status,
          priority: form.priority,
          dueDate: form.dueDate || null,
          assigneeId: form.assigneeId || null,
        }),
      });
      if (!res.ok) throw new Error('Failed to update task');
      return res.json();
    },
    onSuccess: () => {
      setEditTask(null);
      toast.success('Task updated');
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const moveMutation = useMutation({
    mutationFn: async ({
      id,
      toStatus,
      fromStatus,
    }: {
      id: string;
      toStatus: string;
      fromStatus: string;
    }) => {
      const destItems = (allItemsByStage[toStatus] || []).filter((t) => t.id !== id);
      const moves = [
        ...destItems.map((t, i) => ({
          id: t.id,
          status: toStatus,
          sortOrder: i,
        })),
        { id, status: toStatus, sortOrder: destItems.length },
      ];
      if (fromStatus !== toStatus) {
        const srcItems = (allItemsByStage[fromStatus] || []).filter((t) => t.id !== id);
        for (let i = 0; i < srcItems.length; i++) {
          moves.push({
            id: srcItems[i]!.id,
            status: fromStatus,
            sortOrder: i,
          });
        }
      }
      const res = await workspaceFetch(`/api/projects/${projectId}/tasks`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moves }),
      });
      if (!res.ok) throw new Error('Failed to move task');
      return res.json();
    },
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });

  const patchMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await workspaceFetch(`/api/projects/${projectId}/tasks`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to update');
      return res.json();
    },
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const res = await workspaceFetch(
        `/api/projects/${projectId}/tasks?taskId=${encodeURIComponent(taskId)}`,
        { method: 'DELETE' }
      );
      if (!res.ok) throw new Error('Failed to delete');
      return res.json();
    },
    onSuccess: () => {
      setDeleteId(null);
      setEditTask(null);
      toast.success('Task deleted');
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const assigneeField = (
    <div className="grid gap-2">
      <Label>Assignee</Label>
      <Select
        disabled={readOnly}
        value={form.assigneeId || '__none__'}
        onValueChange={(v) =>
          setForm((f) => ({ ...f, assigneeId: v === '__none__' ? '' : v }))
        }
      >
        <SelectTrigger>
          <SelectValue placeholder="Unassigned" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="__none__">Unassigned</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name || m.email}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );

  const renderCard = (item: ProjectTaskRow & { stage: string }) => {
    const done = doneStatusIds.includes(item.status);
    const overdue = isOverdue(item.dueDate, done);
    const labels = item.labels ?? [];
    return (
    <div className="group relative flex flex-col gap-2 p-3">
      <div className="flex items-start justify-between gap-2">
        <Link
          href={taskHref(item.id)}
          className={cn(
            'line-clamp-3 min-w-0 flex-1 text-left text-sm leading-snug hover:underline underline-offset-2',
            done && 'text-muted-foreground'
          )}
        >
          {item.title}
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 focus:opacity-100 sm:h-7 sm:w-7 sm:opacity-0 sm:group-hover:opacity-100"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="size-3.5" />
              <span className="sr-only">Task actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link href={taskHref(item.id)}>
                  <ExternalLink className="mr-2 size-4" />
                  Open
                </Link>
              </DropdownMenuItem>
              {!readOnly && (<DropdownMenuItem onClick={() => openEdit(item)}>
                <Pencil className="mr-2 size-4" />
                Quick edit
              </DropdownMenuItem>)}
            </DropdownMenuGroup>
            {!readOnly && (<><DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => setDeleteId(item.id)}
            >
              <Trash2 className="mr-2 size-4" />
              Delete
            </DropdownMenuItem></>)}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {labels.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {labels.slice(0, 3).map((l) => (
            <span
              key={l.label.id}
              className="max-w-full truncate rounded border px-1.5 py-px text-[10px] text-muted-foreground"
            >
              {l.label.name}
            </span>
          ))}
          {labels.length > 3 ? (
            <span className="text-[10px] text-muted-foreground">+{labels.length - 3}</span>
          ) : null}
        </div>
      ) : null}

      {item.dueDate ? (
        <span
          className={cn(
            'inline-flex w-fit items-center gap-1 text-[11px]',
            overdue ? 'font-medium text-destructive' : 'text-muted-foreground'
          )}
          title={overdue ? 'Overdue' : 'Due date'}
        >
          <CalendarDays className="size-3" aria-hidden />
          {formatDue(item.dueDate)}
          {overdue ? <AlertTriangle className="size-3" aria-label="Overdue" /> : null}
        </span>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 text-[11px] text-muted-foreground">
          <PriorityIcon priority={item.priority} />
          {(item._count?.subtasks ?? 0) > 0 ? (
            <span className="inline-flex items-center gap-0.5" title="Subtasks">
              <ListTodo className="size-3.5" aria-hidden />
              {item._count!.subtasks}
            </span>
          ) : null}
          {(item._count?.comments ?? 0) > 0 ? (
            <span className="inline-flex items-center gap-0.5" title="Comments">
              <MessageSquare className="size-3.5" aria-hidden />
              {item._count!.comments}
            </span>
          ) : null}
        </div>
        {item.assignee ? (
          <span title={item.assignee.name || item.assignee.email || ''}>
            <UserAvatar person={item.assignee} size="sm" />
          </span>
        ) : (
          <span
            title="Unassigned"
            className="inline-block h-7 w-7 rounded-full border border-dashed border-muted-foreground/40"
          />
        )}
      </div>
    </div>
    );
  };

  const taskFormFields = (
    <div className="grid gap-4 py-2">
      <div className="grid gap-2">
        <Label htmlFor="task-title">Title</Label>
        <Input
          id="task-title"
          placeholder="What needs to be done?"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          autoFocus
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="task-desc">Description</Label>
        <Textarea
          id="task-desc"
          placeholder="Optional details…"
          rows={3}
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>Status</Label>
          <Select
            disabled={readOnly}
            value={form.status}
            onValueChange={(status) => setForm((f) => ({ ...f, status }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {boardColumns.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Priority</Label>
          <Select
            disabled={readOnly}
            value={form.priority}
            onValueChange={(priority) => setForm((f) => ({ ...f, priority }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {PROJECT_PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {PRIORITY_LABEL[p] ?? p}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="task-due">Due date</Label>
          <Input
            id="task-due"
            type="date"
            value={form.dueDate}
            onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
          />
        </div>
        {assigneeField}
      </div>
    </div>
  );

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-row flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-56">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search board"
            aria-label="Search tasks"
            className="h-9 pl-9"
          />
        </div>

        {filterPeople.length > 0 || hasUnassigned ? (
          <div className="flex items-center" role="group" aria-label="Filter by assignee">
            {filterPeople.slice(0, 8).map((p) => {
              const active = assigneeFilter.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  title={p.name || p.email || ''}
                  aria-pressed={active}
                  onClick={() =>
                    setAssigneeFilter((cur) =>
                      cur.includes(p.id) ? cur.filter((x) => x !== p.id) : [...cur, p.id]
                    )
                  }
                  className={cn(
                    '-ml-1 first:ml-0 rounded-full ring-2 transition-transform hover:z-10 hover:-translate-y-0.5',
                    active ? 'z-10 ring-primary' : 'ring-background'
                  )}
                >
                  <UserAvatar person={p} size="md" />
                </button>
              );
            })}
            {hasUnassigned ? (
              <button
                type="button"
                title="Unassigned"
                aria-pressed={assigneeFilter.includes('__none__')}
                onClick={() =>
                  setAssigneeFilter((cur) =>
                    cur.includes('__none__')
                      ? cur.filter((x) => x !== '__none__')
                      : [...cur, '__none__']
                  )
                }
                className={cn(
                  '-ml-1 h-8 w-8 rounded-full border border-dashed border-muted-foreground/50 bg-background ring-2 hover:z-10',
                  assigneeFilter.includes('__none__') ? 'z-10 ring-primary' : 'ring-background'
                )}
              >
                <span className="sr-only">Unassigned</span>
              </button>
            ) : null}
          </div>
        ) : null}

        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="h-9 w-[140px]" aria-label="Filter by priority">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="all">All priorities</SelectItem>
              {PROJECT_PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>
                  {PRIORITY_LABEL[p] ?? p}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        {myId ? (
          <Button
            type="button"
            size="sm"
            variant={mineOnly ? 'secondary' : 'ghost'}
            aria-pressed={mineOnly}
            className="h-9"
            onClick={() => setMineOnly((v) => !v)}
          >
            Only my tasks
          </Button>
        ) : null}
        {filtersActive ? (
          <Button type="button" size="sm" variant="ghost" className="h-9 text-muted-foreground" onClick={clearFilters}>
            <X className="mr-1 size-3.5" />
            Clear filters
          </Button>
        ) : null}

        <div className="ml-auto flex items-center gap-2">
        <ToggleGroup
          type="single"
          value={view}
          onValueChange={(v) => {
            if (v === 'board' || v === 'list') setView(v);
          }}
          variant="outline"
          size="sm"
          className={cn('w-fit justify-start', controlledView && 'hidden')}
        >
          <ToggleGroupItem value="board" aria-label="Board view" className="gap-1.5 px-3">
            <LayoutGrid className="size-3.5" />
            Board
          </ToggleGroupItem>
          <ToggleGroupItem value="list" aria-label="List view" className="gap-1.5 px-3">
            <List className="size-3.5" />
            List
          </ToggleGroupItem>
        </ToggleGroup>

        <Button size="sm" onClick={() => openCreate()} className={cn('h-9', readOnly && 'hidden')}>
          <Plus className="mr-1.5 size-3.5" />
          New task
        </Button>
        </div>
      </div>

      {filtersActive && tasks.length === 0 && allTasks.length > 0 ? (
        <EmptyState
          icon={Search}
          title="No tasks match these filters"
          description="Try a different search or clear the filters."
          actionLabel="Clear filters"
          onAction={clearFilters}
          className="rounded-lg border border-dashed"
        />
      ) : view === 'board' ? (
        tasks.length === 0 ? (
          <EmptyState
            icon={ListTodo}
            title="No tasks yet"
            description="Break this project into tasks and drag them across the board as work moves."
            actionLabel="New task"
            onAction={readOnly ? undefined : () => openCreate()}
            className="rounded-lg border border-dashed"
          />
        ) : (
          <PipelineBoard
            className="-mx-4 px-4 sm:mx-0 sm:px-0"
            columns={columns.filter((c) => c.id !== UNMAPPED_STAGE_ID)}
            itemsByStage={itemsByStage}
            onMove={(id, toStage, fromStage) => {
              if (readOnly) return;
              moveMutation.mutate({ id, toStatus: toStage, fromStatus: fromStage });
            }}
            columnFooter={readOnly ? undefined : (stageId) => (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-full justify-start text-muted-foreground hover:text-foreground"
                onClick={() => openCreate(stageId)}
              >
                <Plus className="mr-1.5 size-3.5" />
                Add task
              </Button>
            )}
            renderCard={(item) =>
              renderCard(item as ProjectTaskRow & { stage: string })
            }
          />
        )
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead>Due</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="p-0">
                    <EmptyState
                      icon={ListTodo}
                      title="No tasks yet"
                      description="Create a task to track delivery work in list view."
                      actionLabel="New task"
                      onAction={readOnly ? undefined : () => openCreate()}
                      className="py-10"
                    />
                  </TableCell>
                </TableRow>
              ) : (
                tasks.map((t) => (
                  <TableRow key={t.id} className="group">
                    <TableCell>
                      <Link
                        href={taskHref(t.id)}
                        className="block max-w-[200px] truncate font-medium sm:max-w-[260px] hover:underline underline-offset-2"
                      >
                        {t.title}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Select
                        disabled={readOnly}
                        value={t.status}
                        onValueChange={(status) =>
                          patchMutation.mutate({ id: t.id, status })
                        }
                      >
                        <SelectTrigger className="h-8 w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {boardColumns.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        disabled={readOnly}
                        value={t.priority}
                        onValueChange={(priority) =>
                          patchMutation.mutate({ id: t.id, priority })
                        }
                      >
                        <SelectTrigger className="h-8 w-[110px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {PROJECT_PRIORITIES.map((p) => (
                              <SelectItem key={p} value={p}>
                                {PRIORITY_LABEL[p] ?? p}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        disabled={readOnly}
                        value={t.assigneeId || '__none__'}
                        onValueChange={(v) =>
                          patchMutation.mutate({
                            id: t.id,
                            assigneeId: v === '__none__' ? null : v,
                          })
                        }
                      >
                        <SelectTrigger className="h-8 w-[160px]">
                          <SelectValue placeholder="Unassigned" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value="__none__">Unassigned</SelectItem>
                            {members.map((m) => (
                              <SelectItem key={m.id} value={m.id}>
                                {m.name || m.email}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDue(t.dueDate) || '—'}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={taskHref(t.id)}>Open</Link>
                          </DropdownMenuItem>
                          {!readOnly && (<DropdownMenuItem onClick={() => openEdit(t)}>
                            Quick edit
                          </DropdownMenuItem>)}
                          {!readOnly && (<><DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteId(t.id)}
                          >
                            Delete
                          </DropdownMenuItem></>)}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New task</DialogTitle>
            <DialogDescription>
              Add work to the board. Open the task afterward for comments and attachments.
            </DialogDescription>
          </DialogHeader>
          {taskFormFields}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!form.title.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              ) : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!editTask}
        onOpenChange={(open) => {
          if (!open) setEditTask(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quick edit</DialogTitle>
            <DialogDescription>
              {editTask ? (
                <Link
                  href={taskHref(editTask.id)}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Open full task view
                </Link>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          {taskFormFields}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTask(null)}>
              Cancel
            </Button>
            <Button
              disabled={!form.title.trim() || updateMutation.isPending}
              onClick={() => updateMutation.mutate()}
            >
              {updateMutation.isPending ? (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              ) : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete task?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the task and its comments, watchers, and history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
