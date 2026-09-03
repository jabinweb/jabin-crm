'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { Checkbox } from '@/components/ui/checkbox';
import {
  CheckCircle2,
  Clock,
  Handshake,
  User,
  Building2,
  ExternalLink,
  Ticket,
  Users,
  FileText,
  Receipt,
} from 'lucide-react';
import { toast } from 'sonner';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { cn } from '@/lib/utils';
import { DetailChrome } from '@/components/layout/detail-chrome';
import {
  type ProjectTaskRow,
} from '@/components/projects/project-task-board';
import { burnPercent } from '@/lib/projects/delivery-hours-math';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';

const ProjectTaskBoard = dynamic(
  () => import('@/components/projects/project-task-board').then((mod) => mod.ProjectTaskBoard),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[420px] w-full" />,
  }
);

type ProjectDetail = {
  id: string;
  name: string;
  description: string;
  status: string;
  projectType: string;
  progress: number;
  budgetHours?: number | null;
  startDate: string;
  endDate: string;
  hoursLogged?: number;
  timesheetHours?: number;
  worklogHours?: number;
  customer?: { id: string; organizationName: string } | null;
  deal?: { id: string; title: string; stage?: string; value?: number } | null;
  pmUser?: { id: string; name: string | null; email: string | null } | null;
  tasks?: ProjectTaskRow[];
  projectTaskStatuses?: unknown;
  milestones: Array<{
    id: string;
    title: string;
    status: string;
    dueDate?: string | null;
    sortOrder: number;
  }>;
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
    includedHours?: number | null;
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

function initials(name?: string | null, email?: string | null) {
  return (name || email || '?').trim().slice(0, 2).toUpperCase();
}

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const router = useRouter();
  const { slug, path, workspaceFetch } = useWorkspacePaths();
  const queryClient = useQueryClient();
  const [descExpanded, setDescExpanded] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState('');

  const { data: project, isLoading, isError } = useQuery({
    queryKey: ['project', slug, projectId],
    queryFn: async () => {
      const res = await workspaceFetch(`/api/projects/${projectId}`);
      if (!res.ok) throw new Error('Failed to load project');
      return (await res.json()) as ProjectDetail;
    },
    enabled: !!slug && !!projectId,
  });

  const invoiceQueryKey = ['project-invoices', slug, projectId, project?.customer?.id] as const;
  const { data: linkedInvoices = [] } = useQuery({
    queryKey: invoiceQueryKey,
    queryFn: async () => {
      type Inv = {
        id: string;
        invoiceNumber: string;
        title: string;
        status: string;
        total: number;
        currency: string;
        projectId?: string | null;
      };
      const parse = async (res: Response) => {
        if (!res.ok) return [] as Inv[];
        const body = await res.json();
        return (body.invoices ?? body ?? []) as Inv[];
      };

      const byProject = await parse(
        await workspaceFetch(`/api/invoices?projectId=${encodeURIComponent(projectId)}&limit=50`)
      );
      if (byProject.length > 0) return byProject;

      if (project?.customer?.id) {
        return parse(
          await workspaceFetch(
            `/api/invoices?customerId=${encodeURIComponent(project.customer.id)}&limit=50`
          )
        );
      }
      return [];
    },
    enabled: !!slug && !!projectId && !!project,
  });

  const projectInvoices = linkedInvoices;

  const createInvoiceHref = useMemo(() => {
    if (!project) return path('/dashboard/invoices/new');
    const q = new URLSearchParams();
    q.set('projectId', project.id);
    if (project.customer?.id) q.set('customerId', project.customer.id);
    if (project.deal?.id) q.set('dealId', project.deal.id);
    return path(`/dashboard/invoices/new?${q.toString()}`);
  }, [project, path]);

  const billMutation = useMutation({
    mutationFn: async (retainerId: string) => {
      const res = await workspaceFetch(`/api/retainers/${retainerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'bill_now' }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to bill');
      }
      return res.json();
    },
    onSuccess: (data) => {
      const invoiceId = data.invoice?.id as string | undefined;
      const number = data.invoice?.invoiceNumber || '';
      toast.success(`Draft invoice ${number} created`, {
        action: invoiceId
          ? {
              label: 'Open invoice',
              onClick: () => router.push(path(`/dashboard/invoices/${invoiceId}`)),
            }
          : undefined,
      });
      queryClient.invalidateQueries({ queryKey: ['project', slug, projectId] });
      queryClient.invalidateQueries({ queryKey: invoiceQueryKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const milestoneMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await workspaceFetch(`/api/projects/${projectId}/milestones`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update milestone');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', slug, projectId] });
      toast.success('Milestone updated');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const budgetMutation = useMutation({
    mutationFn: async (budgetHours: number | null) => {
      const res = await workspaceFetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ budgetHours }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update budget');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', slug, projectId] });
      toast.success('Hour budget saved');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const liveUrl = useMemo(
    () => (project?.description ? extractLiveUrl(project.description) : null),
    [project?.description]
  );

  // Sync budget draft when project loads
  useEffect(() => {
    if (project) {
      setBudgetDraft(
        project.budgetHours != null ? String(project.budgetHours) : ''
      );
    }
  }, [project?.id, project?.budgetHours]);


  const descPreview = useMemo(() => {
    if (!project?.description) return '';
    const cleaned = project.description.replace(/\n+/g, ' ').trim();
    if (descExpanded || cleaned.length <= 180) return cleaned;
    return `${cleaned.slice(0, 180)}…`;
  }, [project?.description, descExpanded]);

  const tasks = project?.tasks ?? [];
  const doneTasks = tasks.filter((t) => t.status === 'DONE').length;

  const newTicketHref = useMemo(() => {
    if (!project) return path('/dashboard/tickets/new');
    const q = new URLSearchParams();
    if (project.customer?.id) q.set('customerId', project.customer.id);
    q.set('projectId', project.id);
    return path(`/dashboard/tickets/new?${q.toString()}`);
  }, [project, path]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-4 w-40" />
        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="flex-1 flex flex-col gap-3">
            <Skeleton className="h-9 w-2/3" />
            <Skeleton className="h-16 w-full max-w-xl" />
            <Skeleton className="h-4 w-80" />
          </div>
          <Skeleton className="h-36 w-full lg:w-64" />
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  if (isError || !project) {
    return (
      <EmptyState
        title="Project not found"
        description="It may have been deleted, or you don’t have access."
        actionLabel="Back to projects"
        actionHref={path('/dashboard/projects')}
      />
    );
  }

  const statusMeta = STATUS_META[project.status] ?? {
    label: project.status,
    className: 'bg-muted text-muted-foreground',
  };

  return (
    <div className="flex flex-col gap-6">
      <DetailChrome
        crumbs={[
          { label: 'Projects', href: path('/dashboard/projects') },
          { label: project.name },
        ]}
        backHref={path('/dashboard/projects')}
        backLabel="All projects"
      />

      <div>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1 flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                {project.name}
              </h1>
              <Badge variant="outline" className={cn('font-medium', statusMeta.className)}>
                {statusMeta.label}
              </Badge>
              <Badge variant="secondary" className="font-normal capitalize">
                {project.projectType.replace('_', ' ')}
              </Badge>
            </div>

            {project.description ? (
              <div className="max-w-2xl flex flex-col gap-1.5">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {descPreview}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {project.description.length > 180 ? (
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-xs"
                      onClick={() => setDescExpanded((v) => !v)}
                    >
                      {descExpanded ? 'Show less' : 'Show more'}
                    </Button>
                  ) : null}
                  {liveUrl ? (
                    <Button variant="link" size="sm" className="h-auto p-0 text-xs" asChild>
                      <a href={liveUrl} target="_blank" rel="noopener noreferrer">
                        Open live site
                        <ExternalLink className="ml-1 size-3" />
                      </a>
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
              {project.customer ? (
                <Link
                  href={path(`/dashboard/customers/${project.customer.id}`)}
                  className="inline-flex items-center gap-1.5 hover:text-foreground"
                >
                  <Building2 className="size-3.5" />
                  {project.customer.organizationName}
                </Link>
              ) : null}
              {project.deal ? (
                <Link
                  href={path(`/dashboard/deals/${project.deal.id}`)}
                  className="inline-flex items-center gap-1.5 hover:text-foreground"
                >
                  <Handshake className="size-3.5" />
                  {project.deal.title}
                </Link>
              ) : null}
              {project.pmUser ? (
                <span className="inline-flex items-center gap-1.5">
                  <User className="size-3.5" />
                  {project.pmUser.name || project.pmUser.email}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-3.5" />
                {formatDate(project.startDate)} → {formatDate(project.endDate)}
              </span>
            </div>
          </div>

          <Card className="w-full shrink-0 lg:w-64">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Delivery health
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-semibold tabular-nums">{project.progress}%</span>
              </div>
              <Progress value={project.progress} className="h-2" />
              <Separator />
              <div className="grid grid-cols-2 gap-3 text-center">
                <div>
                  <p className="text-lg font-semibold tabular-nums">
                    {doneTasks}/{tasks.length}
                  </p>
                  <p className="text-[11px] text-muted-foreground">Tasks done</p>
                </div>
                <div>
                  <Link
                    href={path('/dashboard/timesheets')}
                    className="block hover:opacity-80"
                  >
                    <p className="text-lg font-semibold tabular-nums">
                      {(project.hoursLogged ?? 0).toFixed(1)}
                    </p>
                    <p className="text-[11px] text-muted-foreground underline-offset-2 hover:underline">
                      Hours (burn)
                    </p>
                  </Link>
                </div>
              </div>
              {(project.timesheetHours != null || project.worklogHours != null) && (
                <p className="text-[11px] text-muted-foreground text-center">
                  {(project.timesheetHours ?? 0).toFixed(1)}h timesheets ·{' '}
                  {(project.worklogHours ?? 0).toFixed(1)}h worklogs
                  <span className="block opacity-80">
                    Burn prefers worklogs over task-linked timesheets
                  </span>
                </p>
              )}
              {(() => {
                const pct = burnPercent(
                  project.hoursLogged ?? 0,
                  project.budgetHours
                );
                const retainerHours = (project.retainers ?? []).reduce(
                  (s, r) => s + (r.includedHours ?? 0),
                  0
                );
                return (
                  <div className="space-y-2 border-t pt-3">
                    <div className="flex items-end gap-2">
                      <div className="flex-1 space-y-1">
                        <Label htmlFor="budget-hours" className="text-[11px]">
                          Hour budget
                        </Label>
                        <Input
                          id="budget-hours"
                          type="number"
                          min={0}
                          step={0.5}
                          className="h-8"
                          value={budgetDraft}
                          placeholder="e.g. 80"
                          onChange={(e) => setBudgetDraft(e.target.value)}
                          onBlur={() => {
                            const raw = budgetDraft.trim();
                            const next =
                              raw === '' ? null : Number(raw);
                            if (raw !== '' && (!Number.isFinite(next) || (next as number) < 0)) {
                              toast.error('Enter a valid hour budget');
                              return;
                            }
                            const current = project.budgetHours ?? null;
                            if (next === current) return;
                            budgetMutation.mutate(next);
                          }}
                        />
                      </div>
                    </div>
                    {pct != null ? (
                      <>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Burn</span>
                          <span
                            className={cn(
                              'font-medium tabular-nums',
                              pct >= 100 && 'text-destructive'
                            )}
                          >
                            {pct}%
                          </span>
                        </div>
                        <Progress
                          value={Math.min(100, pct)}
                          className={cn('h-1.5', pct >= 100 && '[&>div]:bg-destructive')}
                        />
                      </>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">
                        Set a budget to track burn vs logged hours.
                      </p>
                    )}
                    {retainerHours > 0 ? (
                      <p className="text-[11px] text-muted-foreground">
                        Retainer includes {retainerHours}h / cycle
                      </p>
                    ) : null}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <CheckCircle2 className="size-4" />
            Milestones
          </CardTitle>
          <CardDescription>Track delivery phases — mark done as you ship.</CardDescription>
        </CardHeader>
        <CardContent>
          {project.milestones.length === 0 ? (
            <EmptyState
              title="No milestones"
              description="Milestones appear when this project is set up for delivery."
              className="py-8"
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {project.milestones.map((m) => {
                const done = m.status === 'DONE';
                return (
                  <li
                    key={m.id}
                    className="flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm"
                  >
                    <Checkbox
                      checked={done}
                      disabled={milestoneMutation.isPending}
                      onCheckedChange={(checked) => {
                        void milestoneMutation.mutate({
                          id: m.id,
                          status: checked ? 'DONE' : 'PENDING',
                        });
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className={cn('font-medium', done && 'text-muted-foreground line-through')}>
                        {m.title}
                      </p>
                      {m.dueDate ? (
                        <p className="text-xs text-muted-foreground">
                          Due {formatDate(m.dueDate)}
                        </p>
                      ) : null}
                    </div>
                    <Badge variant="outline" className="shrink-0 font-normal">
                      {m.status.replace(/_/g, ' ')}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Work board</CardTitle>
          <CardDescription>
            Drag tasks across columns, or switch to list for bulk updates.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProjectTaskBoard
            projectId={project.id}
            tasks={tasks}
            progress={project.progress}
            projectTaskStatuses={project.projectTaskStatuses}
            members={[
              ...(project.pmUser
                ? [
                    {
                      id: project.pmUser.id,
                      name: project.pmUser.name,
                      email: project.pmUser.email,
                    },
                  ]
                : []),
              ...project.members.map((m) => ({
                id: m.user.id,
                name: m.user.name,
                email: m.user.email,
              })),
            ].filter(
              (m, i, arr) => arr.findIndex((x) => x.id === m.id) === i
            )}
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Client requests</CardTitle>
            <CardDescription>Support tickets linked to this project.</CardDescription>
          </CardHeader>
          <CardContent>
            {project.tickets.length === 0 ? (
              <EmptyState
                icon={Ticket}
                title="No linked requests"
                description="Create a ticket linked to this project for client change requests."
                actionLabel="New ticket"
                actionHref={newTicketHref}
                className="py-8"
              />
            ) : (
              <div className="flex flex-col gap-2">
                {project.tickets.map((t) => (
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
                ))}
                <Button variant="outline" size="sm" className="mt-2 self-start" asChild>
                  <Link href={newTicketHref}>
                    <Ticket className="mr-1.5 size-3.5" />
                    New ticket
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-base font-semibold">Team</CardTitle>
              <CardDescription>People delivering this engagement.</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild className="h-8 text-xs">
              <Link href={path('/dashboard/retainers')}>Retainers</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {!project.pmUser && project.members.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No team assigned"
                description="Assign a project lead or members to collaborate here."
                className="py-8"
              />
            ) : (
              <div className="flex flex-col gap-2">
                {project.pmUser ? (
                  <div className="flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm">
                    <Avatar className="size-8">
                      <AvatarFallback className="text-xs">
                        {initials(project.pmUser.name, project.pmUser.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">
                        {project.pmUser.name || project.pmUser.email}
                      </p>
                      <p className="text-xs text-muted-foreground">Project lead</p>
                    </div>
                  </div>
                ) : null}
                {project.members.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm"
                  >
                    <Avatar className="size-8">
                      <AvatarFallback className="text-xs">
                        {initials(m.user.name, m.user.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{m.user.name || m.user.email}</p>
                      <p className="text-xs text-muted-foreground">{m.role}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {project.retainers.length > 0 ? (
              <div className="mt-4 flex flex-col gap-2 border-t pt-4">
                {project.retainers.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
                  >
                    <Link
                      href={path('/dashboard/retainers')}
                      className="min-w-0 flex-1 transition-colors hover:opacity-80"
                    >
                      <p className="font-medium">{r.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.currency} {r.amount.toLocaleString()} /{' '}
                        {r.billingCycle.toLowerCase()}
                      </p>
                    </Link>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant="outline">{r.status}</Badge>
                      {r.status === 'ACTIVE' ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="h-7"
                          disabled={billMutation.isPending}
                          onClick={() => billMutation.mutate(r.id)}
                        >
                          Bill
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Receipt className="size-4" />
              Invoices
            </CardTitle>
            <CardDescription>Billing linked to this project or customer.</CardDescription>
          </div>
          <Button size="sm" asChild>
            <Link href={createInvoiceHref}>
              <FileText className="mr-1.5 size-3.5" />
              Create invoice
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {projectInvoices.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="No invoices yet"
              description="Create an invoice for this engagement or bill a retainer above."
              actionLabel="Create invoice"
              actionHref={createInvoiceHref}
              className="py-8"
            />
          ) : (
            <div className="flex flex-col gap-2">
              {projectInvoices.map((inv) => (
                <Link
                  key={inv.id}
                  href={path(`/dashboard/invoices/${inv.id}`)}
                  className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors hover:bg-muted/50"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {inv.invoiceNumber}
                      {inv.title ? ` · ${inv.title}` : ''}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {inv.currency} {Number(inv.total).toLocaleString()}
                    </p>
                  </div>
                  <Badge variant="outline" className="shrink-0 font-normal">
                    {inv.status}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
