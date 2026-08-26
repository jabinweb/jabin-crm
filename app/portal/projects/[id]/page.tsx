'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { ArrowLeft, FolderKanban, Ticket } from 'lucide-react';
import { cn } from '@/lib/utils';

type PortalProject = {
  id: string;
  name: string;
  description: string;
  status: string;
  projectType: string;
  progress: number;
  startDate: string;
  endDate: string;
  milestones: Array<{
    id: string;
    title: string;
    status: string;
    dueDate: string | null;
    completedAt?: string | null;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    dueDate: string | null;
    comments?: Array<{
      id: string;
      body: string;
      createdAt: string;
      author: { name: string | null };
    }>;
    attachments?: Array<{
      id: string;
      url: string;
      name: string | null;
      mimeType: string | null;
      createdAt: string;
    }>;
  }>;
  retainers: Array<{
    id: string;
    name: string;
    amount: number;
    currency: string;
    billingCycle: string;
    nextBillAt: string | null;
  }>;
  tickets: Array<{
    id: string;
    subject: string;
    status: string;
    priority: string;
    createdAt: string;
  }>;
};

const TASK_STATUS_LABEL: Record<string, string> = {
  TODO: 'To do',
  IN_PROGRESS: 'In progress',
  IN_REVIEW: 'In review',
  DONE: 'Done',
};

export default function PortalProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const { data: project, isLoading, isError } = useQuery({
    queryKey: ['portal-project', id],
    queryFn: async () => {
      const res = await fetch(`/api/portal/projects/${id}`);
      if (!res.ok) throw new Error('Failed to load project');
      return (await res.json()) as PortalProject;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (isError || !project) {
    return (
      <EmptyState
        icon={FolderKanban}
        title="Project not found"
        description="This engagement may no longer be available."
        actionLabel="Back to projects"
        actionHref="/portal/projects"
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-3 text-muted-foreground">
          <Link href="/portal/projects">
            <ArrowLeft className="mr-1.5 size-4" />
            All projects
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
          <Badge variant="secondary">{project.status}</Badge>
          <Badge variant="outline" className="capitalize">
            {project.projectType.replace('_', ' ')}
          </Badge>
        </div>
        {project.description ? (
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground whitespace-pre-wrap">{project.description}</p>
        ) : null}
        <p className="mt-2 text-xs text-muted-foreground">
          {new Date(project.startDate).toLocaleDateString()} → {new Date(project.endDate).toLocaleDateString()}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Progress</CardTitle>
            <CardDescription>{project.progress}% complete</CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={project.progress} className="h-2" />
          </CardContent>
        </Card>

        {project.retainers.length > 0 ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Retainer</CardTitle>
              <CardDescription>Active billing plan for this engagement.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {project.retainers.map((r) => (
                <div key={r.id} className="rounded-lg border p-3 text-sm">
                  <p className="font-medium">{r.name}</p>
                  <p className="text-muted-foreground mt-1">
                    {r.currency} {r.amount.toLocaleString()} / {r.billingCycle.toLowerCase()}
                  </p>
                  {r.nextBillAt ? (
                    <p className="text-xs text-muted-foreground mt-1">
                      Next bill: {new Date(r.nextBillAt).toLocaleDateString()}
                    </p>
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Milestones</CardTitle>
            <CardDescription>Delivery checkpoints shared with you.</CardDescription>
          </CardHeader>
          <CardContent>
            {project.milestones.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No milestones yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {project.milestones.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm"
                  >
                    <div>
                      <span
                        className={cn(
                          'font-medium',
                          m.status === 'DONE' && 'text-muted-foreground line-through'
                        )}
                      >
                        {m.title}
                      </span>
                      {m.dueDate ? (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Due {new Date(m.dueDate).toLocaleDateString()}
                        </p>
                      ) : null}
                    </div>
                    <Badge variant="outline">{m.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Active work</CardTitle>
            <CardDescription>
              Delivery tasks with recent updates and shared files.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {project.tasks.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No tasks shared yet.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {project.tasks.map((t) => (
                  <li key={t.id} className="rounded-lg border px-3 py-2.5 text-sm space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{t.title}</span>
                      <Badge variant="secondary">{TASK_STATUS_LABEL[t.status] ?? t.status}</Badge>
                    </div>
                    {(t.comments?.length ?? 0) > 0 ? (
                      <div className="space-y-1.5 border-t pt-2">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          Recent updates
                        </p>
                        {t.comments!.slice(0, 3).map((c) => (
                          <p key={c.id} className="text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">
                              {c.author?.name || 'Team'}
                            </span>
                            {': '}
                            {c.body.length > 160 ? `${c.body.slice(0, 160)}…` : c.body}
                          </p>
                        ))}
                      </div>
                    ) : null}
                    {(t.attachments?.length ?? 0) > 0 ? (
                      <div className="flex flex-wrap gap-2 border-t pt-2">
                        {t.attachments!.map((a) => (
                          <a
                            key={a.id}
                            href={a.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary underline-offset-2 hover:underline"
                          >
                            {a.name || 'Attachment'}
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Ticket className="h-4 w-4" />
            Linked requests
          </CardTitle>
          <CardDescription>Support tickets tied to this project.</CardDescription>
        </CardHeader>
        <CardContent>
          {project.tickets.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <p className="text-sm text-muted-foreground">No linked requests yet.</p>
              <Button asChild size="sm">
                <Link href="/portal/tickets/new">Submit a brief / change request</Link>
              </Button>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {project.tickets.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/portal/tickets/${t.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm hover:bg-muted/40 transition-colors"
                  >
                    <span className="font-medium">{t.subject}</span>
                    <Badge variant="outline">{t.status}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
