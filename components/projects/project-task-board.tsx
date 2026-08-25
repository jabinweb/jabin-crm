'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  PipelineBoard,
  buildBoardState,
  type PipelineBoardCard,
} from '@/components/pipelines/pipeline-board';
import { UNMAPPED_STAGE_ID } from '@/lib/pipelines';
import { PROJECT_TASK_COLUMNS, PROJECT_PRIORITIES } from '@/lib/projects/task-board';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
  LayoutGrid,
  List,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  ListTodo,
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

function initials(name?: string | null, email?: string | null) {
  const src = (name || email || '?').trim();
  return src.slice(0, 2).toUpperCase();
}

type TaskFormState = {
  title: string;
  description: string;
  status: string;
  priority: string;
  dueDate: string;
};

const emptyForm = (status = 'TODO'): TaskFormState => ({
  title: '',
  description: '',
  status,
  priority: 'MEDIUM',
  dueDate: '',
});

type Props = {
  projectId: string;
  tasks: ProjectTaskRow[];
  progress?: number;
};

export function ProjectTaskBoard({ projectId, tasks: initialTasks }: Props) {
  const { slug, workspaceFetch } = useWorkspacePaths();
  const queryClient = useQueryClient();
  const [view, setView] = useState<'board' | 'list'>('board');
  const [createOpen, setCreateOpen] = useState(false);
  const [editTask, setEditTask] = useState<ProjectTaskRow | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<TaskFormState>(emptyForm());

  const tasks = initialTasks.map((t) => ({ ...t, stage: t.status }));

  const { columns, itemsByStage } = useMemo(
    () => buildBoardState(tasks, PROJECT_TASK_COLUMNS),
    [tasks]
  );

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['project', slug, projectId] });
    void queryClient.invalidateQueries({ queryKey: ['projects', slug] });
  };

  const openCreate = (status = 'TODO') => {
    setForm(emptyForm(status));
    setCreateOpen(true);
  };

  const openEdit = (task: ProjectTaskRow) => {
    setEditTask(task);
    setForm({
      title: task.title,
      description: task.description || '',
      status: task.status,
      priority: task.priority,
      dueDate: toDateInput(task.dueDate),
    });
  };

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
      const destItems = (itemsByStage[toStatus] || []).filter((t) => t.id !== id);
      const moves = [
        ...destItems.map((t, i) => ({
          id: t.id,
          status: toStatus,
          sortOrder: i,
        })),
        { id, status: toStatus, sortOrder: destItems.length },
      ];
      if (fromStatus !== toStatus) {
        const srcItems = (itemsByStage[fromStatus] || []).filter((t) => t.id !== id);
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

  const renderCard = (item: ProjectTaskRow & { stage: string }) => (
    <div className="group relative flex flex-col gap-2 p-3">
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          className="min-w-0 flex-1 text-left text-sm font-medium leading-snug hover:underline underline-offset-2"
          onClick={() => openEdit(item)}
        >
          {item.title}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="size-3.5" />
              <span className="sr-only">Task actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => openEdit(item)}>
                <Pencil className="mr-2 size-4" />
                Edit
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => setDeleteId(item.id)}
            >
              <Trash2 className="mr-2 size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Badge
          variant="outline"
          className={cn('text-[10px] font-medium', PRIORITY_CLASS[item.priority])}
        >
          {PRIORITY_LABEL[item.priority] ?? item.priority}
        </Badge>
        {item.dueDate ? (
          <span className="text-[10px] text-muted-foreground">
            {formatDue(item.dueDate)}
          </span>
        ) : null}
      </div>

      {item.assignee ? (
        <div className="flex items-center gap-2">
          <Avatar className="size-5">
            <AvatarImage src={item.assignee.image || undefined} alt="" />
            <AvatarFallback className="text-[9px]">
              {initials(item.assignee.name, item.assignee.email)}
            </AvatarFallback>
          </Avatar>
          <span className="truncate text-[11px] text-muted-foreground">
            {item.assignee.name || item.assignee.email}
          </span>
        </div>
      ) : null}
    </div>
  );

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
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label>Status</Label>
          <Select
            value={form.status}
            onValueChange={(status) => setForm((f) => ({ ...f, status }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {PROJECT_TASK_COLUMNS.map((c) => (
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
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ToggleGroup
          type="single"
          value={view}
          onValueChange={(v) => {
            if (v === 'board' || v === 'list') setView(v);
          }}
          variant="outline"
          size="sm"
          className="w-fit justify-start"
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

        <Button size="sm" onClick={() => openCreate()}>
          <Plus className="mr-1.5 size-3.5" />
          New task
        </Button>
      </div>

      {view === 'board' ? (
        tasks.length === 0 ? (
          <EmptyState
            icon={ListTodo}
            title="No tasks yet"
            description="Break this project into tasks and drag them across the board as work moves."
            actionLabel="New task"
            onAction={() => openCreate()}
            className="rounded-lg border border-dashed"
          />
        ) : (
          <PipelineBoard
            columns={columns.filter((c) => c.id !== UNMAPPED_STAGE_ID)}
            itemsByStage={itemsByStage}
            onMove={(id, toStage, fromStage) =>
              moveMutation.mutate({ id, toStatus: toStage, fromStatus: fromStage })
            }
            columnFooter={(stageId) => (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-auto h-8 w-full justify-start text-muted-foreground"
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
                      onAction={() => openCreate()}
                      className="py-10"
                    />
                  </TableCell>
                </TableRow>
              ) : (
                tasks.map((t) => (
                  <TableRow key={t.id} className="group">
                    <TableCell>
                      <button
                        type="button"
                        className="max-w-[260px] truncate text-left font-medium hover:underline underline-offset-2"
                        onClick={() => openEdit(t)}
                      >
                        {t.title}
                      </button>
                    </TableCell>
                    <TableCell>
                      <Select
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
                            {PROJECT_TASK_COLUMNS.map((c) => (
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
                      {t.assignee ? (
                        <div className="flex items-center gap-2">
                          <Avatar className="size-6">
                            <AvatarImage src={t.assignee.image || undefined} alt="" />
                            <AvatarFallback className="text-[10px]">
                              {initials(t.assignee.name, t.assignee.email)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="max-w-[120px] truncate text-sm text-muted-foreground">
                            {t.assignee.name || t.assignee.email}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDue(t.dueDate) || '—'}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 opacity-70 group-hover:opacity-100"
                          >
                            <MoreHorizontal className="size-4" />
                            <span className="sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuGroup>
                            <DropdownMenuItem onClick={() => openEdit(t)}>
                              <Pencil className="mr-2 size-4" />
                              Edit
                            </DropdownMenuItem>
                          </DropdownMenuGroup>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteId(t.id)}
                          >
                            <Trash2 className="mr-2 size-4" />
                            Delete
                          </DropdownMenuItem>
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New task</DialogTitle>
            <DialogDescription>
              Add work to this project. You can drag it across the board anytime.
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
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Plus className="mr-2 size-4" />
              )}
              Create task
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit task</DialogTitle>
            <DialogDescription>
              Update status, priority, or details for this work item.
            </DialogDescription>
          </DialogHeader>
          {taskFormFields}
          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => editTask && setDeleteId(editTask.id)}
            >
              <Trash2 className="mr-2 size-4" />
              Delete
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditTask(null)}>
                Cancel
              </Button>
              <Button
                disabled={!form.title.trim() || updateMutation.isPending}
                onClick={() => updateMutation.mutate()}
              >
                {updateMutation.isPending ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : null}
                Save changes
              </Button>
            </div>
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
            <AlertDialogTitle>Delete this task?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. The task will be removed from the board and
              list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
