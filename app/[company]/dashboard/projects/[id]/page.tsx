'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Loader2,
  ArrowLeft,
  CheckCircle2,
  Circle,
  PlayCircle,
  Clock,
  User,
  Building2,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { cn } from '@/lib/utils';

type Milestone = {
  id: string;
  title: string;
  status: string;
  dueDate?: string | null;
  sortOrder: number;
};

type ProjectDetail = {
  id: string;
  name: string;
  description: string;
  status: string;
  projectType: string;
  progress: number;
  startDate: string;
  endDate: string;
  hoursLogged?: number;
  customer?: { id: string; organizationName: string } | null;
  deal?: { id: string; title: string; stage?: string; value?: number } | null;
  pmUser?: { id: string; name: string | null; email: string | null } | null;
  milestones: Milestone[];
  members: Array<{
    id: string;
    role: string;
    user: { id: string; name: string | null; email: string | null };
  }>;
  tickets: Array<{
    id: string;
    subject: string;
    status: string;
    priority: string;
    ticketType: string | null;
  }>;
  retainers: Array<{
    id: string;
    name: string;
    amount: number;
    currency: string;
    billingCycle: string;
    status: string;
    nextBillAt: string | null;
  }>;
};

const STATUS_META: Record<string, { label: string; className: string }> = {
  ACTIVE: {
    label: 'Active',
    className: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400',
  },
  ON_HOLD: {
    label: 'On hold',
    className: 'bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400',
  },
  COMPLETED: {
    label: 'Completed',
    className: 'bg-blue-500/10 text-blue-700 border-blue-500/20 dark:text-blue-400',
  },
  CANCELLED: {
    label: 'Cancelled',
    className: 'bg-muted text-muted-foreground border-border',
  },
};

function statusIcon(status: string) {
  if (status === 'DONE') {
    return <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />;
  }
  if (status === 'IN_PROGRESS') {
    return <PlayCircle className="h-4 w-4 shrink-0 text-blue-600" />;
  }
  return <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />;
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function extractLiveUrl(description: string): string | null {
  const m = description.match(/https?:\/\/[^\s)]+/i);
  return m?.[0] ?? null;
}

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const { slug, path, workspaceFetch } = useWorkspacePaths();
  const queryClient = useQueryClient();
  const [milestoneTitle, setMilestoneTitle] = useState('');
  const [descExpanded, setDescExpanded] = useState(false);

  const { data: project, isLoading, isError } = useQuery({
    queryKey: ['project', slug, projectId],
    queryFn: async () => {
      const res = await workspaceFetch(`/api/projects/${projectId}`);
      if (!res.ok) throw new Error('Failed to load project');
      return (await res.json()) as ProjectDetail;
    },
    enabled: !!slug && !!projectId,
  });

  const addMilestone = useMutation({
    mutationFn: async () => {
      const res = await workspaceFetch(`/api/projects/${projectId}/milestones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: milestoneTitle }),
      });
      if (!res.ok) throw new Error('Failed to add milestone');
      return res.json();
    },
    onSuccess: () => {
      setMilestoneTitle('');
      toast.success('Milestone added');
      queryClient.invalidateQueries({ queryKey: ['project', slug, projectId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMilestone = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await workspaceFetch(`/api/projects/${projectId}/milestones`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) throw new Error('Failed to update milestone');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', slug, projectId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cycleStatus = (status: string) => {
    if (status === 'PENDING') return 'IN_PROGRESS';
    if (status === 'IN_PROGRESS') return 'DONE';
    return 'PENDING';
  };

  const liveUrl = useMemo(
    () => (project?.description ? extractLiveUrl(project.description) : null),
    [project?.description]
  );

  const descPreview = useMemo(() => {
    if (!project?.description) return '';
    const cleaned = project.description.replace(/\n+/g, ' ').trim();
    if (descExpanded || cleaned.length <= 180) return cleaned;
    return `${cleaned.slice(0, 180)}…`;
  }, [project?.description, descExpanded]);

  const milestoneDone = project?.milestones.filter((m) => m.status === 'DONE').length ?? 0;
  const milestoneTotal = project?.milestones.length ?? 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !project) {
    return (
      <div className="space-y-4 py-12 text-center">
        <p className="text-muted-foreground">Project not found.</p>
        <Button variant="outline" asChild>
          <Link href={path('/dashboard/projects')}>Back to projects</Link>
        </Button>
      </div>
    );
  }

  const statusMeta = STATUS_META[project.status] ?? {
    label: project.status,
    className: 'bg-muted text-muted-foreground',
  };

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-3 -ml-2 text-muted-foreground">
          <Link href={path('/dashboard/projects')}>
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Projects
          </Link>
        </Button>

        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{project.name}</h1>
              <Badge variant="outline" className={cn('font-medium', statusMeta.className)}>
                {statusMeta.label}
              </Badge>
              <Badge variant="secondary" className="capitalize font-normal">
                {project.projectType.replace('_', ' ')}
              </Badge>
            </div>

            {project.description ? (
              <div className="max-w-2xl">
                <p className="text-sm text-muted-foreground leading-relaxed">{descPreview}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-3">
                  {project.description.length > 180 && (
                    <button
                      type="button"
                      className="text-xs font-medium text-foreground hover:underline"
                      onClick={() => setDescExpanded((v) => !v)}
                    >
                      {descExpanded ? 'Show less' : 'Show more'}
                    </button>
                  )}
                  {liveUrl && (
                    <a
                      href={liveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Open live site ↗
                    </a>
                  )}
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
              {project.customer && (
                <Link
                  href={path(`/dashboard/customers/${project.customer.id}`)}
                  className="inline-flex items-center gap-1.5 hover:text-foreground"
                >
                  <Building2 className="h-3.5 w-3.5" />
                  {project.customer.organizationName}
                </Link>
              )}
              {project.pmUser && (
                <span className="inline-flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" />
                  {project.pmUser.name || project.pmUser.email}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {formatDate(project.startDate)} → {formatDate(project.endDate)}
              </span>
            </div>
          </div>

          <Card className="w-full lg:w-64 shrink-0">
            <CardContent className="p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-semibold tabular-nums">{project.progress}%</span>
              </div>
              <Progress value={project.progress} className="h-2" />
              <Separator />
              <div className="grid grid-cols-2 gap-3 text-center">
                <div>
                  <p className="text-lg font-semibold tabular-nums">
                    {milestoneDone}/{milestoneTotal}
                  </p>
                  <p className="text-[11px] text-muted-foreground">Milestones</p>
                </div>
                <div>
                  <p className="text-lg font-semibold tabular-nums">
                    {(project.hoursLogged ?? 0).toFixed(0)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">Hours</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Milestones</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {project.milestones.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No milestones yet. Add the first phase below.
              </p>
            ) : (
              project.milestones.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() =>
                    updateMilestone.mutate({ id: m.id, status: cycleStatus(m.status) })
                  }
                  className="flex w-full items-center gap-3 rounded-lg border bg-card px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/50"
                >
                  {statusIcon(m.status)}
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        'font-medium truncate',
                        m.status === 'DONE' && 'text-muted-foreground line-through'
                      )}
                    >
                      {m.title}
                    </p>
                    <p className="text-[11px] text-muted-foreground capitalize">
                      {m.status.replace(/_/g, ' ').toLowerCase()}
                      {m.dueDate ? ` · due ${formatDate(m.dueDate)}` : ''}
                    </p>
                  </div>
                </button>
              ))
            )}
            <div className="flex gap-2 pt-2">
              <Input
                placeholder="Add milestone…"
                value={milestoneTitle}
                onChange={(e) => setMilestoneTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && milestoneTitle.trim()) {
                    addMilestone.mutate();
                  }
                }}
              />
              <Button
                size="icon"
                disabled={!milestoneTitle.trim() || addMilestone.isPending}
                onClick={() => addMilestone.mutate()}
              >
                {addMilestone.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Click a milestone to cycle: pending → in progress → done.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Client requests</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {project.tickets.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No linked requests yet.
              </p>
            ) : (
              project.tickets.map((t) => (
                <Link
                  key={t.id}
                  href={path(`/dashboard/tickets/${t.id}`)}
                  className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors hover:bg-muted/50"
                >
                  <span className="truncate font-medium">{t.subject}</span>
                  <Badge variant="outline" className="shrink-0 font-normal">
                    {t.status}
                  </Badge>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base font-semibold">Retainers</CardTitle>
            <Button variant="ghost" size="sm" asChild className="h-8 text-xs">
              <Link href={path('/dashboard/retainers')}>Manage</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {project.retainers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No retainers on this project.
              </p>
            ) : (
              project.retainers.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm"
                >
                  <div>
                    <p className="font-medium">{r.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.currency} {r.amount.toLocaleString()} /{' '}
                      {r.billingCycle.toLowerCase()}
                    </p>
                  </div>
                  <Badge variant="outline">{r.status}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Team</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {project.pmUser && (
              <div className="flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                  {(project.pmUser.name || project.pmUser.email || '?')
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <div>
                  <p className="font-medium">
                    {project.pmUser.name || project.pmUser.email}
                  </p>
                  <p className="text-xs text-muted-foreground">Project lead</p>
                </div>
              </div>
            )}
            {project.members.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                  {(m.user.name || m.user.email || '?').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium">{m.user.name || m.user.email}</p>
                  <p className="text-xs text-muted-foreground">{m.role}</p>
                </div>
              </div>
            ))}
            {!project.pmUser && project.members.length === 0 && (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No team assigned yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
