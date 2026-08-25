'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { DetailChrome } from '@/components/layout/detail-chrome';
import { DetailSkeleton } from '@/components/loading';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Eye,
  EyeOff,
  Loader2,
  Save,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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
  assignee: Person | null;
  reporter: Person | null;
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

export default function ProjectTaskDetailPage() {
  const params = useParams<{ company: string; id: string; taskId: string }>();
  const projectId = params.id;
  const taskId = params.taskId;
  const { path, workspaceFetch, slug } = useWorkspacePaths();
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [descriptionHtml, setDescriptionHtml] = useState('');
  const [commentHtml, setCommentHtml] = useState('');

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
    setDescriptionHtml(task.descriptionHtml || task.description || '');
  }, [task?.id, task?.title, task?.descriptionHtml, task?.description]);

  const statusColumns = useMemo(
    () =>
      resolveProjectTaskColumns(
        task?.projectTaskStatuses
          ? { projectTaskStatuses: task.projectTaskStatuses }
          : undefined
      ),
    [task?.projectTaskStatuses]
  );

  const members = useQuery({
    queryKey: ['project-members', slug, projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const res = await workspaceFetch(`/api/projects/${projectId}`);
      if (!res.ok) return [] as Person[];
      const data = await res.json();
      const list = (data.members || []) as Array<{ user: Person }>;
      const people = list.map((m) => m.user);
      if (data.pmUser) people.unshift(data.pmUser);
      const byId = new Map(people.map((p) => [p.id, p]));
      return Array.from(byId.values());
    },
  });

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

  if (isLoading || !task) {
    return <DetailSkeleton />;
  }

  const columns =
    statusColumns.length > 0 ? statusColumns : PROJECT_TASK_COLUMNS;

  return (
    <div className="flex flex-col gap-6">
      <DetailChrome
        crumbs={[
          { label: 'Projects', href: path('/dashboard/projects') },
          {
            label: task.project.name,
            href: path(`/dashboard/projects/${projectId}`),
          },
          { label: task.title },
        ]}
        backHref={path(`/dashboard/projects/${projectId}`)}
        backLabel="Back to project"
      />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            if (title.trim() && title.trim() !== task.title) {
              patchMutation.mutate({ title: title.trim() });
            }
          }}
          className="h-auto max-w-2xl flex-1 border-0 px-0 text-2xl font-bold tracking-tight shadow-none focus-visible:ring-0"
        />
        <Button
          variant="outline"
          size="sm"
          disabled={watchMutation.isPending}
          onClick={() => watchMutation.mutate(!!task.watching)}
          className="inline-flex items-center gap-1.5"
        >
          {task.watching ? (
            <EyeOff className="size-3.5 shrink-0" />
          ) : (
            <Eye className="size-3.5 shrink-0" />
          )}
          {task.watching ? 'Unwatch' : 'Watch'}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-6">
          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-muted-foreground">Description</Label>
              <Button
                size="sm"
                variant="secondary"
                disabled={patchMutation.isPending}
                onClick={() => patchMutation.mutate({ descriptionHtml })}
                className="inline-flex items-center gap-1.5"
              >
                {patchMutation.isPending ? (
                  <Loader2 className="size-3.5 shrink-0 animate-spin" />
                ) : (
                  <Save className="size-3.5 shrink-0" />
                )}
                Save
              </Button>
            </div>
            <RichTextEditor
              content={descriptionHtml}
              onChange={setDescriptionHtml}
              placeholder="Describe the work, acceptance criteria, links…"
              folder="project-tasks"
              onUploaded={(file) => {
                void workspaceFetch(
                  `/api/projects/${projectId}/tasks/${taskId}/attachments`,
                  {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...file, source: 'DESCRIPTION' }),
                  }
                ).then(() => invalidate());
              }}
            />
          </section>

          <Tabs defaultValue="comments">
            <TabsList>
              <TabsTrigger value="comments">Comments</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
              <TabsTrigger value="files">Files</TabsTrigger>
            </TabsList>

            <TabsContent value="comments" className="space-y-4 pt-4">
              <div className="space-y-3">
                {(task.comments || []).map((c) => (
                  <div key={c.id} className="rounded-lg border p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <Avatar className="size-6">
                        <AvatarImage src={c.author.image || undefined} />
                        <AvatarFallback className="text-[10px]">
                          {initials(c.author.name, c.author.email)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">
                        {c.author.name || c.author.email}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(c.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div
                      className="prose prose-sm dark:prose-invert max-w-none"
                      dangerouslySetInnerHTML={{ __html: c.body }}
                    />
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <RichTextEditor
                  content={commentHtml}
                  onChange={setCommentHtml}
                  placeholder="Leave a comment… (paste images to upload)"
                  minHeightClass="min-h-[100px]"
                  folder="project-tasks"
                />
                <Button
                  size="sm"
                  disabled={commentMutation.isPending || !commentHtml.trim()}
                  onClick={() => commentMutation.mutate()}
                  className="inline-flex items-center gap-1.5"
                >
                  {commentMutation.isPending ? (
                    <Loader2 className="size-3.5 shrink-0 animate-spin" />
                  ) : null}
                  Comment
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="history" className="pt-4">
              <ScrollArea className="h-[420px] pr-3">
                <ul className="space-y-3">
                  {(task.activities || []).map((a) => (
                    <li key={a.id} className="flex gap-3 text-sm">
                      <Avatar className="size-7 shrink-0">
                        <AvatarImage src={a.actor?.image || undefined} />
                        <AvatarFallback className="text-[10px]">
                          {initials(a.actor?.name, a.actor?.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p>{a.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(a.createdAt).toLocaleString()} · {a.eventType}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="files" className="space-y-3 pt-4">
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  className="max-w-sm"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (!file) return;
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
                  }}
                />
              </div>
              <ul className="space-y-2">
                {(task.attachments || []).map((a) => (
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
                      className="shrink-0 text-destructive"
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
                {task.attachments?.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No files yet.</p>
                ) : null}
              </ul>
            </TabsContent>
          </Tabs>
        </div>

        <aside className="space-y-4 rounded-lg border p-4">
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Select
              value={task.status}
              onValueChange={(status) => patchMutation.mutate({ status })}
            >
              <SelectTrigger className="h-9">
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
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Priority</Label>
            <Select
              value={task.priority}
              onValueChange={(priority) => patchMutation.mutate({ priority })}
            >
              <SelectTrigger className="h-9">
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

          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Assignee</Label>
            <Select
              value={task.assigneeId || '__none__'}
              onValueChange={(v) =>
                patchMutation.mutate({
                  assigneeId: v === '__none__' ? null : v,
                })
              }
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="__none__">Unassigned</SelectItem>
                  {(members.data || []).map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name || m.email}
                    </SelectItem>
                  ))}
                  {task.assignee &&
                  !(members.data || []).some((m) => m.id === task.assignee!.id) ? (
                    <SelectItem value={task.assignee.id}>
                      {task.assignee.name || task.assignee.email}
                    </SelectItem>
                  ) : null}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Due date</Label>
            <Input
              type="date"
              className="h-9"
              defaultValue={toDateInput(task.dueDate)}
              onChange={(e) =>
                patchMutation.mutate({
                  dueDate: e.target.value || null,
                })
              }
            />
          </div>

          <Separator />

          <div className="grid gap-1">
            <Label className="text-xs text-muted-foreground">Reporter</Label>
            <p className="text-sm leading-none">
              {task.reporter?.name ||
                task.reporter?.email ||
                session?.user?.name ||
                '—'}
            </p>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Watchers</Label>
            <div className="flex flex-wrap gap-1">
              {(task.watchers || []).map((w) => (
                <Badge key={w.id} variant="secondary" className="font-normal">
                  {w.user.name || w.user.email}
                </Badge>
              ))}
              {task.watchers?.length === 0 ? (
                <span className="text-sm text-muted-foreground">None</span>
              ) : null}
            </div>
          </div>

          <div className="grid gap-1">
            <Label className="text-xs text-muted-foreground">Project</Label>
            <Link
              href={path(`/dashboard/projects/${task.project.id}`)}
              className={cn(
                'text-sm text-primary underline-offset-4 hover:underline'
              )}
            >
              {task.project.name}
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
