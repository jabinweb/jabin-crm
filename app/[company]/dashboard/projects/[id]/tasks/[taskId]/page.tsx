'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { DetailChrome } from '@/components/layout/detail-chrome';
import { ProjectTaskDetailSkeleton } from '@/components/loading';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  PROJECT_PRIORITIES,
  PROJECT_TASK_COLUMNS,
} from '@/lib/projects/task-board';
import { resolveProjectTaskColumns } from '@/lib/projects/task-statuses';
import {
  ChevronDown,
  ChevronRight,
  CheckSquare2,
  Eye,
  EyeOff,
  Loader2,
  Paperclip,
  Plus,
  Save,
  Square,
  Tag,
  Link2,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { resolveDoneStatusIds } from '@/lib/projects/task-statuses';

const RichTextEditor = dynamic(
  () => import('@/components/ui/rich-text-editor').then((mod) => mod.RichTextEditor),
  {
    ssr: false,
    loading: () => <div className="min-h-[140px] animate-pulse rounded-md border bg-muted/40" />,
  }
);

type Person = {
  id: string;
  name: string | null;
  email: string | null;
  image?: string | null;
};

type TaskDetail = {
  id: string;
  title: string;
  description: string | null;
  descriptionHtml: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  assigneeId: string | null;
  reporterId: string | null;
  parentTaskId?: string | null;
  assignee: Person | null;
  reporter: Person | null;
  parentTask?: { id: string; title: string } | null;
  subtasks?: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    assigneeId: string | null;
    assignee: Person | null;
  }>;
  project: { id: string; name: string };
  watching: boolean;
  watchers: Array<{ id: string; user: Person }>;
  comments: Array<{
    id: string;
    body: string;
    createdAt: string;
    author: Person;
  }>;
  activities: Array<{
    id: string;
    eventType: string;
    description: string;
    createdAt: string;
    actor: Person | null;
  }>;
  attachments: Array<{
    id: string;
    url: string;
    name: string | null;
    mimeType: string | null;
    createdAt: string;
  }>;
  projectTaskStatuses?: unknown;
  memberOptions?: Person[];
  labels?: Array<{ label: { id: string; name: string; color: string } }>;
  linksFrom?: Array<{
    id: string;
    type: string;
    targetTask: { id: string; title: string; status: string };
  }>;
  linksTo?: Array<{
    id: string;
    type: string;
    sourceTask: { id: string; title: string; status: string };
  }>;
  worklogs?: Array<{
    id: string;
    hours: number;
    note: string | null;
    loggedAt: string;
    user: Person;
  }>;
};

const PRIORITY_LABEL: Record<string, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
};

function initials(name?: string | null, email?: string | null) {
  return (name || email || '?').trim().slice(0, 2).toUpperCase();
}

function toDateInput(value?: string | null) {
  if (!value) return '';
  return value.slice(0, 10);
}

function FieldRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[120px_1fr] items-center gap-3 py-1.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function SectionHeader({
  open,
  onToggle,
  title,
  count,
  actions,
}: {
  open: boolean;
  onToggle: () => void;
  title: string;
  count?: number;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <button
        type="button"
        onClick={onToggle}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        {title}
        {typeof count === 'number' ? (
          <span className="font-normal text-muted-foreground">({count})</span>
        ) : null}
      </button>
      {actions}
    </div>
  );
}

export default function ProjectTaskDetailPage() {
  const params = useParams<{ company: string; id: string; taskId: string }>();
  const projectId = params.id;
  const taskId = params.taskId;
  const { path, workspaceFetch, slug } = useWorkspacePaths();
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [descriptionHtml, setDescriptionHtml] = useState<string | null>(null);
  const [commentHtml, setCommentHtml] = useState('');
  const [commentOpen, setCommentOpen] = useState(false);
  const [descOpen, setDescOpen] = useState(true);
  const [attachOpen, setAttachOpen] = useState(true);
  const [subtasksOpen, setSubtasksOpen] = useState(true);
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [subtaskTitle, setSubtaskTitle] = useState('');
  const [activityOpen, setActivityOpen] = useState(true);
  const [labelsOpen, setLabelsOpen] = useState(true);
  const [linksOpen, setLinksOpen] = useState(true);
  const [worklogsOpen, setWorklogsOpen] = useState(true);
  const [newLabelName, setNewLabelName] = useState('');
  const [worklogHours, setWorklogHours] = useState('');
  const [worklogNote, setWorklogNote] = useState('');
  const [activityTab, setActivityTab] = useState<'all' | 'comments' | 'history'>(
    'comments'
  );

  const { data: task, isLoading } = useQuery({
    queryKey: ['project-task', slug, projectId, taskId],
    queryFn: async () => {
      const res = await workspaceFetch(
        `/api/projects/${projectId}/tasks/${taskId}`
      );
      if (!res.ok) throw new Error('Failed to load task');
      return res.json() as Promise<TaskDetail>;
    },
  });

  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setDescriptionHtml(null);
  }, [task?.id]);

  const statusColumns = useMemo(
    () =>
      resolveProjectTaskColumns(
        task?.projectTaskStatuses
          ? { projectTaskStatuses: task.projectTaskStatuses }
          : undefined
      ),
    [task?.projectTaskStatuses]
  );

  const doneStatusIds = useMemo(
    () =>
      resolveDoneStatusIds(
        task?.projectTaskStatuses
          ? { projectTaskStatuses: task.projectTaskStatuses }
          : undefined
      ),
    [task?.projectTaskStatuses]
  );

  const members = useMemo(() => task?.memberOptions ?? [], [task?.memberOptions]);

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: ['project-task', slug, projectId, taskId],
    });
    void queryClient.invalidateQueries({
      queryKey: ['project', slug, projectId],
    });
  };

  const patchMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await workspaceFetch(
        `/api/projects/${projectId}/tasks/${taskId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Update failed');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Saved');
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const commentMutation = useMutation({
    mutationFn: async () => {
      const res = await workspaceFetch(
        `/api/projects/${projectId}/tasks/${taskId}/comments`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body: commentHtml }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to comment');
      }
      return res.json();
    },
    onSuccess: () => {
      setCommentHtml('');
      setCommentOpen(false);
      toast.success('Comment added');
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const watchMutation = useMutation({
    mutationFn: async (watching: boolean) => {
      const res = await workspaceFetch(
        `/api/projects/${projectId}/tasks/${taskId}/watch`,
        { method: watching ? 'DELETE' : 'POST' }
      );
      if (!res.ok) throw new Error('Failed to update watch');
      return res.json();
    },
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });

  const attachMutation = useMutation({
    mutationFn: async (file: {
      url: string;
      name: string;
      mimeType?: string;
      size?: number;
      fileId?: string;
    }) => {
      const res = await workspaceFetch(
        `/api/projects/${projectId}/tasks/${taskId}/attachments`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...file, source: 'SIDEBAR' }),
        }
      );
      if (!res.ok) throw new Error('Failed to attach');
      return res.json();
    },
    onSuccess: () => {
      toast.success('Attachment added');
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const labelMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await workspaceFetch(
        `/api/projects/${projectId}/tasks/${taskId}/labels`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, color: 'slate' }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to add label');
      }
      return res.json();
    },
    onSuccess: () => {
      setNewLabelName('');
      toast.success('Label added');
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const worklogMutation = useMutation({
    mutationFn: async () => {
      const res = await workspaceFetch(
        `/api/projects/${projectId}/tasks/${taskId}/worklogs`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            hours: Number(worklogHours),
            note: worklogNote.trim() || undefined,
          }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to log time');
      }
      return res.json();
    },
    onSuccess: () => {
      setWorklogHours('');
      setWorklogNote('');
      toast.success('Time logged');
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createSubtaskMutation = useMutation({
    mutationFn: async (title: string) => {
      const res = await workspaceFetch(`/api/projects/${projectId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, parentTaskId: taskId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create subtask');
      }
      return res.json();
    },
    onSuccess: () => {
      setSubtaskTitle('');
      setAddingSubtask(false);
      toast.success('Subtask added');
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const patchSubtaskStatus = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: string;
    }) => {
      const res = await workspaceFetch(
        `/api/projects/${projectId}/tasks/${id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        }
      );
      if (!res.ok) throw new Error('Failed to update subtask');
      return res.json();
    },
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });

  const uploadAttachment = async (file: File) => {
    const form = new FormData();
    form.append('file', file);
    form.append('folder', 'project-tasks');
    form.append('isPublic', 'true');
    const res = await workspaceFetch('/api/upload', {
      method: 'POST',
      body: form,
    });
    if (!res.ok) {
      toast.error('Upload failed');
      return;
    }
    const data = await res.json();
    attachMutation.mutate({
      url: data.url,
      name: data.filename || file.name,
      mimeType: data.mimeType || file.type,
      size: data.size || file.size,
      fileId: data.fileId,
    });
  };

  if (isLoading || !task) {
    return <ProjectTaskDetailSkeleton />;
  }

  const columns =
    statusColumns.length > 0 ? statusColumns : PROJECT_TASK_COLUMNS;

  const subtasks = task.subtasks || [];
  const subtasksDone = subtasks.filter((s) =>
    doneStatusIds.includes(s.status)
  ).length;
  const isSubtask = !!task.parentTaskId;
  const defaultDoneStatus = doneStatusIds[0] || 'DONE';
  const defaultTodoStatus =
    columns.find((c) => !doneStatusIds.includes(c.id))?.id || 'TODO';

  const descriptionContent =
    descriptionHtml ?? (task.descriptionHtml || task.description || '');

  const showComments = activityTab === 'all' || activityTab === 'comments';
  const showHistory = activityTab === 'all' || activityTab === 'history';

  return (
    <div className="flex flex-col gap-4">
      <DetailChrome
        crumbs={[
          { label: 'Projects', href: path('/dashboard/projects') },
          {
            label: task.project.name,
            href: path(`/dashboard/projects/${projectId}`),
          },
          ...(task.parentTask
            ? [
                {
                  label: task.parentTask.title,
                  href: path(
                    `/dashboard/projects/${projectId}/tasks/${task.parentTask.id}`
                  ),
                },
              ]
            : []),
          { label: task.title },
        ]}
        backHref={
          task.parentTask
            ? path(
                `/dashboard/projects/${projectId}/tasks/${task.parentTask.id}`
              )
            : path(`/dashboard/projects/${projectId}`)
        }
        backLabel={task.parentTask ? 'Back to parent' : 'Back to project'}
      />

      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Main column */}
        <div className="min-w-0 space-y-6 lg:pr-8">
          {task.parentTask ? (
            <p className="text-sm text-muted-foreground">
              Subtask of{' '}
              <Link
                href={path(
                  `/dashboard/projects/${projectId}/tasks/${task.parentTask.id}`
                )}
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                {task.parentTask.title}
              </Link>
            </p>
          ) : null}

          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              if (title.trim() && title.trim() !== task.title) {
                patchMutation.mutate({ title: title.trim() });
              }
            }}
            className="h-auto w-full border-0 px-0 text-2xl font-semibold tracking-tight shadow-none focus-visible:ring-0"
          />

          {/* Description */}
          <section className="space-y-3">
            <SectionHeader
              open={descOpen}
              onToggle={() => setDescOpen((v) => !v)}
              title="Description"
              actions={
                descOpen ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={patchMutation.isPending}
                    onClick={() =>
                      patchMutation.mutate({
                        descriptionHtml: descriptionContent,
                      })
                    }
                    className="h-8 gap-1.5 text-muted-foreground"
                  >
                    {patchMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save
                  </Button>
                ) : null
              }
            />
            {descOpen ? (
              <RichTextEditor
                key={task.id}
                content={descriptionContent}
                onChange={setDescriptionHtml}
                placeholder="Add a description…"
                folder="project-tasks"
                onUploaded={(file) => {
                  void workspaceFetch(
                    `/api/projects/${projectId}/tasks/${taskId}/attachments`,
                    {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        ...file,
                        source: 'DESCRIPTION',
                      }),
                    }
                  ).then(() => invalidate());
                }}
              />
            ) : null}
          </section>

          {/* Attachments */}
          <section className="space-y-3">
            <SectionHeader
              open={attachOpen}
              onToggle={() => setAttachOpen((v) => !v)}
              title="Attachments"
              count={task.attachments?.length ?? 0}
              actions={
                <label className="inline-flex cursor-pointer items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
                  <Paperclip className="h-4 w-4" />
                  Add
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (file) void uploadAttachment(file);
                    }}
                  />
                </label>
              }
            />
            {attachOpen ? (
              task.attachments?.length ? (
                <ul className="space-y-2">
                  {task.attachments.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
                    >
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate text-sm text-primary underline-offset-4 hover:underline"
                      >
                        {a.name || a.url}
                      </a>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 shrink-0 text-destructive"
                        onClick={async () => {
                          const res = await workspaceFetch(
                            `/api/projects/${projectId}/tasks/${taskId}/attachments?attachmentId=${encodeURIComponent(a.id)}`,
                            { method: 'DELETE' }
                          );
                          if (!res.ok) {
                            toast.error('Failed to remove attachment');
                            return;
                          }
                          toast.success('Attachment removed');
                          invalidate();
                        }}
                      >
                        Remove
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No attachments</p>
              )
            ) : null}
          </section>

          {/* Subtasks (Jira-style) — only on top-level tasks */}
          {!isSubtask ? (
            <section className="space-y-3">
              <SectionHeader
                open={subtasksOpen}
                onToggle={() => setSubtasksOpen((v) => !v)}
                title="Subtasks"
                count={subtasks.length}
                actions={
                  <button
                    type="button"
                    onClick={() => {
                      setSubtasksOpen(true);
                      setAddingSubtask(true);
                    }}
                    className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                  >
                    <Plus className="h-4 w-4" />
                    Add subtask
                  </button>
                }
              />
              {subtasksOpen ? (
                <div className="space-y-2">
                  {subtasks.length > 0 ? (
                    <>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-foreground/70 transition-all"
                            style={{
                              width: `${
                                subtasks.length
                                  ? (subtasksDone / subtasks.length) * 100
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                        <span className="shrink-0 tabular-nums">
                          {subtasksDone}/{subtasks.length} done
                        </span>
                      </div>
                      <ul className="divide-y rounded-md border">
                        {subtasks.map((st) => {
                          const done = doneStatusIds.includes(st.status);
                          const statusLabel =
                            columns.find((c) => c.id === st.status)?.label ||
                            st.status;
                          return (
                            <li
                              key={st.id}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted/40"
                            >
                              <button
                                type="button"
                                title={
                                  done ? 'Mark as not done' : 'Mark as done'
                                }
                                className="shrink-0 text-muted-foreground hover:text-foreground"
                                onClick={() =>
                                  patchSubtaskStatus.mutate({
                                    id: st.id,
                                    status: done
                                      ? defaultTodoStatus
                                      : defaultDoneStatus,
                                  })
                                }
                              >
                                {done ? (
                                  <CheckSquare2 className="h-4 w-4" />
                                ) : (
                                  <Square className="h-4 w-4" />
                                )}
                              </button>
                              <Link
                                href={path(
                                  `/dashboard/projects/${projectId}/tasks/${st.id}`
                                )}
                                className={cn(
                                  'min-w-0 flex-1 truncate text-sm hover:underline',
                                  done && 'text-muted-foreground line-through'
                                )}
                              >
                                {st.title}
                              </Link>
                              <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                                {statusLabel}
                              </span>
                              {st.assignee ? (
                                <Avatar className="h-6 w-6 shrink-0 rounded-full">
                                  <AvatarImage
                                    src={st.assignee.image || undefined}
                                  />
                                  <AvatarFallback className="rounded-full text-[10px]">
                                    {initials(
                                      st.assignee.name,
                                      st.assignee.email
                                    )}
                                  </AvatarFallback>
                                </Avatar>
                              ) : (
                                <span className="h-6 w-6 shrink-0" aria-hidden />
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </>
                  ) : !addingSubtask ? (
                    <p className="text-sm text-muted-foreground">
                      No subtasks yet
                    </p>
                  ) : null}

                  {addingSubtask ? (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <Input
                        autoFocus
                        value={subtaskTitle}
                        placeholder="What needs to be done?"
                        className="h-9"
                        onChange={(e) => setSubtaskTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && subtaskTitle.trim()) {
                            createSubtaskMutation.mutate(subtaskTitle.trim());
                          }
                          if (e.key === 'Escape') {
                            setAddingSubtask(false);
                            setSubtaskTitle('');
                          }
                        }}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="h-9"
                          disabled={
                            createSubtaskMutation.isPending ||
                            !subtaskTitle.trim()
                          }
                          onClick={() =>
                            createSubtaskMutation.mutate(subtaskTitle.trim())
                          }
                        >
                          {createSubtaskMutation.isPending ? (
                            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                          ) : null}
                          Create
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-9"
                          onClick={() => {
                            setAddingSubtask(false);
                            setSubtaskTitle('');
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>
          ) : null}

          {/* Labels */}
          <section className="space-y-3 border-t pt-4">
            <SectionHeader
              open={labelsOpen}
              onToggle={() => setLabelsOpen((v) => !v)}
              title="Labels"
              count={task.labels?.length ?? 0}
            />
            {labelsOpen ? (
              <div className="space-y-3">
                {(task.labels?.length ?? 0) > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {task.labels!.map((entry) => (
                      <span
                        key={entry.label.id}
                        className="inline-flex items-center gap-1 rounded-md border bg-muted/40 px-2 py-0.5 text-xs font-medium"
                      >
                        <Tag className="h-3 w-3 text-muted-foreground" />
                        {entry.label.name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No labels</p>
                )}
                <div className="flex gap-2">
                  <Input
                    value={newLabelName}
                    onChange={(e) => setNewLabelName(e.target.value)}
                    placeholder="Add label…"
                    className="h-8 max-w-xs"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newLabelName.trim()) {
                        labelMutation.mutate(newLabelName.trim());
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8"
                    disabled={labelMutation.isPending || !newLabelName.trim()}
                    onClick={() => labelMutation.mutate(newLabelName.trim())}
                  >
                    Add
                  </Button>
                </div>
              </div>
            ) : null}
          </section>

          {/* Linked work items */}
          <section className="space-y-3 border-t pt-4">
            <SectionHeader
              open={linksOpen}
              onToggle={() => setLinksOpen((v) => !v)}
              title="Linked work items"
              count={(task.linksFrom?.length ?? 0) + (task.linksTo?.length ?? 0)}
            />
            {linksOpen ? (
              (task.linksFrom?.length ?? 0) + (task.linksTo?.length ?? 0) > 0 ? (
                <ul className="space-y-2 text-sm">
                  {(task.linksFrom || []).map((link) => (
                    <li key={link.id} className="flex items-center gap-2">
                      <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{link.type.replace(/_/g, ' ')}</span>
                      <Link
                        href={path(
                          `/dashboard/projects/${projectId}/tasks/${link.targetTask.id}`
                        )}
                        className="truncate hover:underline"
                      >
                        {link.targetTask.title}
                      </Link>
                    </li>
                  ))}
                  {(task.linksTo || []).map((link) => (
                    <li key={link.id} className="flex items-center gap-2">
                      <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{link.type.replace(/_/g, ' ')} (from)</span>
                      <Link
                        href={path(
                          `/dashboard/projects/${projectId}/tasks/${link.sourceTask.id}`
                        )}
                        className="truncate hover:underline"
                      >
                        {link.sourceTask.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No linked items</p>
              )
            ) : null}
          </section>

          {/* Log time */}
          <section className="space-y-3 border-t pt-4">
            <SectionHeader
              open={worklogsOpen}
              onToggle={() => setWorklogsOpen((v) => !v)}
              title="Log time"
              count={task.worklogs?.length ?? 0}
            />
            {worklogsOpen ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-end gap-2">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Hours</label>
                    <Input
                      type="number"
                      min="0.25"
                      step="0.25"
                      value={worklogHours}
                      onChange={(e) => setWorklogHours(e.target.value)}
                      placeholder="1.5"
                      className="h-8 w-24"
                    />
                  </div>
                  <div className="min-w-[200px] flex-1 space-y-1">
                    <label className="text-xs text-muted-foreground">Note</label>
                    <Input
                      value={worklogNote}
                      onChange={(e) => setWorklogNote(e.target.value)}
                      placeholder="Optional note"
                      className="h-8"
                    />
                  </div>
                  <Button
                    size="sm"
                    className="h-8 gap-1"
                    disabled={
                      worklogMutation.isPending ||
                      !worklogHours ||
                      Number(worklogHours) <= 0
                    }
                    onClick={() => worklogMutation.mutate()}
                  >
                    <Clock className="h-3.5 w-3.5" />
                    Log
                  </Button>
                </div>
                {(task.worklogs?.length ?? 0) > 0 ? (
                  <ul className="divide-y rounded-md border text-sm">
                    {task.worklogs!.map((w) => (
                      <li key={w.id} className="flex items-center justify-between gap-2 px-3 py-2">
                        <div className="min-w-0">
                          <span className="font-medium tabular-nums">{w.hours}h</span>
                          {w.note ? (
                            <span className="ml-2 text-muted-foreground">{w.note}</span>
                          ) : null}
                        </div>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {w.user.name || w.user.email} ·{' '}
                          {new Date(w.loggedAt).toLocaleDateString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No time logged yet</p>
                )}
              </div>
            ) : null}
          </section>

          {/* Activity */}
          <section className="space-y-4 border-t pt-4">
            <SectionHeader
              open={activityOpen}
              onToggle={() => setActivityOpen((v) => !v)}
              title="Activity"
            />

            {activityOpen ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  {(
                    [
                      ['all', 'All'],
                      ['comments', 'Comments'],
                      ['history', 'History'],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setActivityTab(value)}
                      className={cn(
                        'rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
                        activityTab === value
                          ? 'border-border bg-background text-foreground'
                          : 'border-transparent text-muted-foreground hover:bg-muted/60'
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Composer */}
                {(activityTab === 'all' || activityTab === 'comments') && (
                  <div className="flex items-start gap-3">
                    <Avatar className="mt-0.5 h-8 w-8 shrink-0 rounded-full">
                      <AvatarImage src={session?.user?.image || undefined} />
                      <AvatarFallback className="rounded-full bg-muted text-xs font-medium">
                        {initials(session?.user?.name, session?.user?.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1 space-y-2">
                      {commentOpen ? (
                        <>
                          <RichTextEditor
                            content={commentHtml}
                            onChange={setCommentHtml}
                            placeholder="Add a comment…"
                            minHeightClass="min-h-[100px]"
                            folder="project-tasks"
                          />
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              disabled={
                                commentMutation.isPending || !commentHtml.trim()
                              }
                              onClick={() => commentMutation.mutate()}
                              className="h-8"
                            >
                              {commentMutation.isPending ? (
                                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                              ) : null}
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8"
                              onClick={() => {
                                setCommentOpen(false);
                                setCommentHtml('');
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setCommentOpen(true)}
                          className="flex h-10 w-full items-center rounded-md border bg-background px-3 text-left text-sm text-muted-foreground hover:bg-muted/40"
                        >
                          Add a comment…
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Feed */}
                <div className="space-y-5">
                  {showComments &&
                    (task.comments || []).map((c) => (
                      <div key={c.id} className="flex items-start gap-3">
                        <Avatar className="h-8 w-8 shrink-0 rounded-full">
                          <AvatarImage src={c.author.image || undefined} />
                          <AvatarFallback className="rounded-full bg-muted text-xs font-medium">
                            {initials(c.author.name, c.author.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">
                              {c.author.name || c.author.email}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(c.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <div
                            className="text-sm leading-relaxed [&_a]:text-primary [&_a]:underline [&_p]:my-1 [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5"
                            dangerouslySetInnerHTML={{ __html: c.body }}
                          />
                        </div>
                      </div>
                    ))}

                  {showHistory &&
                    (task.activities || []).map((a) => (
                      <div key={a.id} className="flex items-start gap-3">
                        <Avatar className="h-8 w-8 shrink-0 rounded-full">
                          <AvatarImage src={a.actor?.image || undefined} />
                          <AvatarFallback className="rounded-full bg-muted text-xs font-medium">
                            {initials(a.actor?.name, a.actor?.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <p className="text-sm leading-snug">{a.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(a.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}

                  {showComments &&
                  !showHistory &&
                  (task.comments || []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No comments yet
                    </p>
                  ) : null}

                  {showHistory &&
                  !showComments &&
                  (task.activities || []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No history yet
                    </p>
                  ) : null}
                </div>
              </>
            ) : null}
          </section>
        </div>

        {/* Details sidebar — Jira-style key/value */}
        <aside className="space-y-4 border-t pt-4 lg:sticky lg:top-4 lg:self-start lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={task.status}
              onValueChange={(status) => patchMutation.mutate({ status })}
            >
              <SelectTrigger className="h-9 w-auto min-w-[140px] border-primary/30 bg-primary/5 font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {columns.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              disabled={watchMutation.isPending}
              onClick={() => watchMutation.mutate(!!task.watching)}
              className="h-9 gap-1.5"
            >
              {task.watching ? (
                <EyeOff className="h-4 w-4" strokeWidth={1.75} />
              ) : (
                <Eye className="h-4 w-4" strokeWidth={1.75} />
              )}
              {task.watching ? 'Unwatch' : 'Watch'}
              {(task.watchers?.length ?? 0) > 0 ? (
                <span className="text-muted-foreground">
                  {task.watchers.length}
                </span>
              ) : null}
            </Button>
          </div>

            <div>
            <p className="mb-1 text-sm font-semibold">Details</p>
            <div className="divide-y-0">
              {task.parentTask ? (
                <FieldRow label="Parent">
                  <Link
                    href={path(
                      `/dashboard/projects/${projectId}/tasks/${task.parentTask.id}`
                    )}
                    className="text-sm text-primary underline-offset-4 hover:underline"
                  >
                    {task.parentTask.title}
                  </Link>
                </FieldRow>
              ) : null}

              <FieldRow label="Assignee">
                <Select
                  value={task.assigneeId || '__none__'}
                  onValueChange={(v) =>
                    patchMutation.mutate({
                      assigneeId: v === '__none__' ? null : v,
                    })
                  }
                >
                  <SelectTrigger className="h-8 border-0 bg-transparent px-0 shadow-none hover:bg-muted/50 focus:ring-0">
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
                      {task.assignee &&
                      !members.some(
                        (m) => m.id === task.assignee!.id
                      ) ? (
                        <SelectItem value={task.assignee.id}>
                          {task.assignee.name || task.assignee.email}
                        </SelectItem>
                      ) : null}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </FieldRow>

              <FieldRow label="Priority">
                <Select
                  value={task.priority}
                  onValueChange={(priority) =>
                    patchMutation.mutate({ priority })
                  }
                >
                  <SelectTrigger className="h-8 border-0 bg-transparent px-0 shadow-none hover:bg-muted/50 focus:ring-0">
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
              </FieldRow>

              <FieldRow label="Due date">
                <Input
                  type="date"
                  className="h-8 border-0 bg-transparent px-0 shadow-none hover:bg-muted/50 focus-visible:ring-0"
                  defaultValue={toDateInput(task.dueDate)}
                  onChange={(e) =>
                    patchMutation.mutate({
                      dueDate: e.target.value || null,
                    })
                  }
                />
              </FieldRow>

              <FieldRow label="Reporter">
                <span className="text-sm">
                  {task.reporter?.name ||
                    task.reporter?.email ||
                    session?.user?.name ||
                    '—'}
                </span>
              </FieldRow>

              <FieldRow label="Watchers">
                {(task.watchers || []).length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {task.watchers.map((w) => (
                      <span key={w.id} className="text-sm">
                        {w.user.name || w.user.email}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">None</span>
                )}
              </FieldRow>

              <FieldRow label="Project">
                <Link
                  href={path(`/dashboard/projects/${task.project.id}`)}
                  className="text-sm text-primary underline-offset-4 hover:underline"
                >
                  {task.project.name}
                </Link>
              </FieldRow>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
