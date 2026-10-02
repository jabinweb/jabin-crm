'use client';

import { useSession } from 'next-auth/react';
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
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
import { Skeleton } from '@/components/ui/skeleton';
import { AvatarStack, UserAvatar } from '@/components/ui/user-avatar';
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
  BookOpen,
  Plus,
  X,
  LayoutGrid,
  List,
  Info,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { useFeatureModule } from '@/components/feature-module-guard';

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
  /** From the API: the viewer may change tasks / the project itself. */
  canWrite?: boolean;
  canManage?: boolean;
  startDate: string;
  endDate: string;
  hoursLogged?: number;
  timesheetHours?: number;
  worklogHours?: number;
  customer?: { id: string; organizationName: string } | null;
  deal?: { id: string; title: string; stage?: string; value?: number } | null;
  pmUser?: { id: string; name: string | null; email: string | null; image?: string | null } | null;
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
    user: { id: string; name: string | null; email: string | null; image?: string | null };
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

type ProjectTab = 'board' | 'list' | 'overview';

const PROJECT_TAB_CLASS =
  '-mb-px gap-1.5 rounded-none border-b-2 border-transparent px-0.5 pb-2 pt-1 text-sm font-medium normal-case tracking-normal text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground';

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
  const router = useRouter();
  const { slug, path, workspaceFetch } = useWorkspacePaths();
  const queryClient = useQueryClient();
  const [descExpanded, setDescExpanded] = useState(false);
  // Retainers, billing and timesheets are admin pages; invoices aren't for technicians
  const { data: session } = useSession();
  const viewerRole = session?.user?.role ?? '';
  const isAdminRole = viewerRole === 'ADMIN' || viewerRole === 'SUPER_ADMIN';
  const [budgetDraft, setBudgetDraft] = useState('');
  const searchParams = useSearchParams();
  const initialTab = searchParams?.get('tab');
  const [tab, setTabState] = useState<ProjectTab>(
    initialTab === 'list' || initialTab === 'overview' ? initialTab : 'board'
  );
  const setTab = (next: ProjectTab) => {
    setTabState(next);
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    if (next === 'board') params.delete('tab');
    else params.set('tab', next);
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : '?', { scroll: false });
  };
  const [milestonesOpen, setMilestonesOpen] = useState(false);

  const { data: project, isLoading, isError } = useQuery({
    queryKey: ['project', slug, projectId],
    queryFn: async () => {
      const res = await workspaceFetch(`/api/projects/${projectId}`);
      if (!res.ok) throw new Error('Failed to load project');
      return (await res.json()) as ProjectDetail;
    },
    enabled: !!slug && !!projectId,
  });

  // INVOICES is plan-gated: /api/invoices returns 403 when the module is off.
  const invoicesEnabled = useFeatureModule('INVOICES') === true;
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
        // 403 (module off for this plan) and other failures read as "no invoices".
        if (!res.ok) return [] as Inv[];
        const body = await res.json();
        return (body.invoices ?? body ?? []) as Inv[];
      };

      const byProjectRes = await workspaceFetch(
        `/api/invoices?projectId=${encodeURIComponent(projectId)}&limit=50`
      );
      if (byProjectRes.status === 403) return [] as Inv[];
      const byProject = await parse(byProjectRes);
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
    enabled: !!slug && !!projectId && !!project && invoicesEnabled,
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

  const [newMilestone, setNewMilestone] = useState('');
  const invalidateProject = () =>
    queryClient.invalidateQueries({ queryKey: ['project', slug, projectId] });

  const addMilestoneMutation = useMutation({
    mutationFn: async (title: string) => {
      const res = await workspaceFetch(`/api/projects/${projectId}/milestones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to add milestone');
      }
      return res.json();
    },
    onSuccess: () => {
      setNewMilestone('');
      invalidateProject();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMilestoneMutation = useMutation({
    mutationFn: async (milestoneId: string) => {
      const res = await workspaceFetch(
        `/api/projects/${projectId}/milestones?milestoneId=${encodeURIComponent(milestoneId)}`,
        { method: 'DELETE' }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to remove milestone');
      }
      return res.json();
    },
    onSuccess: () => invalidateProject(),
    onError: (e: Error) => toast.error(e.message),
  });

  // Workspace staff (project team first): the lead picker and task assignees, like Jira —
  // anyone in the workspace can be assigned, not only people already on the project
  const { data: staff = [] } = useQuery<Array<{ id: string; name: string | null; email: string }>>({
    queryKey: ['project-staff', slug, projectId],
    queryFn: async () => {
      const res = await workspaceFetch(`/api/projects/${projectId}/mentionable`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!project && project.canWrite !== false,
  });

  const leadMutation = useMutation({
    mutationFn: async (pmUserId: string | null) => {
      const res = await workspaceFetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pmUserId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to set project lead');
      }
      return res.json();
    },
    onSuccess: () => {
      invalidateProject();
      toast.success('Project lead updated');
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

  const milestones = project.milestones;
  const milestonesDone = milestones.filter((m) => m.status === 'DONE').length;
  const nextMilestone = milestones.find((m) => m.status !== 'DONE');
  const team = [
    ...(project.pmUser ? [project.pmUser] : []),
    ...project.members.map((m) => m.user),
  ].filter((p, i, arr) => arr.findIndex((x) => x.id === p.id) === i);
  const initials = project.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
  const dueSoon = new Date(project.endDate);
  const overdueProject =
    dueSoon < new Date() && project.status !== 'COMPLETED' && project.status !== 'CANCELLED';
  const milestoneBar = (
    <div className="flex h-2 w-full gap-1" aria-hidden>
      {milestones.length === 0 ? (
        <span className="h-full flex-1 rounded-full bg-muted" />
      ) : (
        milestones.map((m) => (
          <span
            key={m.id}
            title={`${m.title} — ${m.status === 'DONE' ? 'done' : m.status === 'IN_PROGRESS' ? 'in progress' : 'not started'}`}
            className={cn(
              'h-full flex-1 rounded-full',
              m.status === 'DONE'
                ? 'bg-emerald-500'
                : m.status === 'IN_PROGRESS'
                  ? 'bg-amber-500'
                  : 'bg-muted'
            )}
          />
        ))
      )}
    </div>
  );

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <DetailChrome
        crumbs={[
          { label: 'Projects', href: path('/dashboard/projects') },
          { label: project.name },
        ]}
        backHref={path('/dashboard/projects')}
        backLabel="All projects"
      >
        <Button variant="outline" size="sm" asChild>
          <Link href={path(`/dashboard/projects/${project.id}/docs`)}>
            <BookOpen className="mr-1.5 size-3.5" />
            Docs
          </Link>
        </Button>
        {isAdminRole && (
          <Button variant="outline" size="sm" asChild>
            <Link href={path('/dashboard/retainers')}>Retainers</Link>
          </Button>
        )}
      </DetailChrome>

      {/* Title row: project tile, name, status — team on the right */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">
            {initials || 'P'}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="min-w-0 truncate text-xl font-semibold tracking-tight md:text-2xl">
                {project.name}
              </h1>
              <Badge variant="outline" className={cn('font-medium', statusMeta.className)}>
                {statusMeta.label}
              </Badge>
              <Badge variant="secondary" className="font-normal capitalize">
                {project.projectType.replace('_', ' ')}
              </Badge>
            </div>
            {project.customer ? (
              <p className="truncate text-xs text-muted-foreground">
                {project.customer.organizationName}
              </p>
            ) : null}
          </div>
        </div>
        {team.length > 0 ? (
          <button
            type="button"
            className="flex items-center gap-2 self-start rounded-md px-1 py-0.5 text-xs text-muted-foreground hover:bg-muted sm:self-auto"
            onClick={() => setTab('overview')}
            title="Team"
          >
            <AvatarStack people={team} max={5} size="sm" />
            <span className="hidden sm:inline">{team.length} on team</span>
          </button>
        ) : null}
      </div>

      {/* Status strip: milestones as a progress bar (click for details) + key numbers */}
      <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto]">
        <button
          type="button"
          onClick={() => setMilestonesOpen(true)}
          className="flex min-w-0 flex-col gap-2 rounded-lg border bg-card px-3 py-2.5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Milestones: ${milestonesDone} of ${milestones.length} done. Open details`}
        >
          <div className="flex min-w-0 items-center justify-between gap-3 text-xs">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="size-3.5 text-muted-foreground" />
              Milestones
              <span className="font-normal text-muted-foreground">
                {milestonesDone}/{milestones.length}
              </span>
            </span>
            <span className="min-w-0 truncate text-muted-foreground">
              {milestones.length === 0
                ? project.canManage
                  ? 'Add phases →'
                  : 'None yet'
                : nextMilestone
                  ? `Next: ${nextMilestone.title}`
                  : 'All done'}
            </span>
          </div>
          {milestoneBar}
        </button>

        <div className="grid grid-cols-4 divide-x rounded-lg border bg-card text-center">
          {[
            { label: 'Progress', value: `${project.progress}%` },
            { label: 'Tasks done', value: `${doneTasks}/${tasks.length}` },
            {
              label: 'Hours',
              value:
                project.budgetHours != null
                  ? `${(project.hoursLogged ?? 0).toFixed(1)}/${project.budgetHours}`
                  : (project.hoursLogged ?? 0).toFixed(1),
            },
            {
              label: 'Due',
              value: new Date(project.endDate).toLocaleDateString(undefined, {
                day: 'numeric',
                month: 'short',
              }),
              danger: overdueProject,
            },
          ].map((stat) => (
            <div key={stat.label} className="flex min-w-0 flex-col justify-center px-3 py-2">
              <span
                className={cn(
                  'truncate text-sm font-semibold tabular-nums',
                  stat.danger && 'text-destructive'
                )}
              >
                {stat.value}
              </span>
              <span className="truncate text-[11px] text-muted-foreground">{stat.label}</span>
            </div>
          ))}
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as ProjectTab)}>
        {/* Underline tabs (Jira-style) rather than the app's default pill tabs */}
        <TabsList className="h-auto w-full justify-start gap-5 rounded-none border-0 border-b bg-transparent p-0 sm:justify-start">
          <TabsTrigger value="board" className={PROJECT_TAB_CLASS}>
            <LayoutGrid className="size-3.5" />
            Board
          </TabsTrigger>
          <TabsTrigger value="list" className={PROJECT_TAB_CLASS}>
            <List className="size-3.5" />
            List
          </TabsTrigger>
          <TabsTrigger value="overview" className={PROJECT_TAB_CLASS}>
            <Info className="size-3.5" />
            Overview
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'overview' ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px] [&>*]:min-w-0">
          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">About</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
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
                {!project.description ? (
                  <p className="text-sm text-muted-foreground">No description yet.</p>
                ) : null}
              </CardContent>
            </Card>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 [&>*]:min-w-0">
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
                <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0 pb-3">
                  <div className="min-w-0">
                    <CardTitle className="text-base font-semibold">Team</CardTitle>
                    <CardDescription>People delivering this engagement.</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {project.canManage ? (
                    <div className="grid gap-1.5">
                      <Label className="text-xs text-muted-foreground">Project lead</Label>
                      <Select
                        value={project.pmUser?.id ?? 'none'}
                        disabled={leadMutation.isPending}
                        onValueChange={(v) => leadMutation.mutate(v === 'none' ? null : v)}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Choose a lead" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No lead</SelectItem>
                          {staff.map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.name || u.email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}
                  {!project.pmUser && project.members.length === 0 ? (
                    <EmptyState
                      icon={Users}
                      title="No team assigned"
                      description={
                        project.canManage
                          ? 'Pick a project lead above to own this project.'
                          : 'Ask an admin to assign a project lead.'
                      }
                      className="py-6"
                    />
                  ) : (
                    <div className="flex flex-col gap-2">
                      {project.pmUser ? (
                        <div className="flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm">
                          <UserAvatar person={project.pmUser} size="md" />
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
                          <UserAvatar person={m.user} size="md" />
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
                            {r.status === 'ACTIVE' && isAdminRole ? (
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

            {invoicesEnabled ? (
            <Card>
              <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0 pb-3">
                <div className="min-w-0">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Receipt className="size-4" />
                    Invoices
                  </CardTitle>
                  <CardDescription>Billing linked to this project or customer.</CardDescription>
                </div>
                {viewerRole !== 'TECHNICIAN' && (
                <Button size="sm" asChild>
                  <Link href={createInvoiceHref}>
                    <FileText className="mr-1.5 size-3.5" />
                    Create invoice
                  </Link>
                </Button>
                )}
              </CardHeader>
              <CardContent>
                {projectInvoices.length === 0 ? (
                  <EmptyState
                    icon={Receipt}
                    title="No invoices yet"
                    description="Create an invoice for this engagement or bill a retainer above."
                    actionLabel={viewerRole !== 'TECHNICIAN' ? 'Create invoice' : undefined}
                    actionHref={viewerRole !== 'TECHNICIAN' ? createInvoiceHref : undefined}
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
            ) : null}
          </div>
          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Hours & budget
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div>
                  <div>
                    <Link
                      href={path('/dashboard/timesheets')}
                      className={cn('block', isAdminRole ? 'hover:opacity-80' : 'pointer-events-none')}
                      aria-disabled={!isAdminRole}
                      tabIndex={isAdminRole ? undefined : -1}
                    >
                      <p className="text-lg font-semibold tabular-nums">
                        {(project.hoursLogged ?? 0).toFixed(1)}
                      </p>
                      <p className="text-[11px] text-muted-foreground underline-offset-2 hover:underline">
                        Hours logged
                      </p>
                    </Link>
                  </div>
                </div>
                {((project.timesheetHours ?? 0) > 0 || (project.worklogHours ?? 0) > 0) && (
                  <p className="text-[11px] text-muted-foreground text-center">
                    {(project.worklogHours ?? 0).toFixed(1)}h on tasks ·{' '}
                    {(project.timesheetHours ?? 0).toFixed(1)}h on timesheets
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
                            disabled={!project.canManage}
                            placeholder="e.g. 80"
                            onChange={(e) => setBudgetDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') e.currentTarget.blur();
                            }}
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
                            <span className="text-muted-foreground">Budget used</span>
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
                          {project.canManage
                            ? 'Set the hours you planned; saves when you press Enter.'
                            : 'No hour budget set.'}
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
      ) : (
        <ProjectTaskBoard
          view={tab === 'list' ? 'list' : 'board'}
          readOnly={project.canWrite === false}
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
            ...staff.map((u) => ({ id: u.id, name: u.name, email: u.email })),
          ].filter(
            (m, i, arr) => arr.findIndex((x) => x.id === m.id) === i
          )}
        />
      )}

      <Dialog open={milestonesOpen} onOpenChange={setMilestonesOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Milestones</DialogTitle>
            <DialogDescription>
              The big phases of {project.name} — {milestonesDone} of {milestones.length} done.
            </DialogDescription>
          </DialogHeader>
          {milestoneBar}
          <div className="max-h-[60vh] overflow-y-auto">
            {project.milestones.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">
                {project.canManage ? 'No milestones yet — add the first one below.' : 'No milestones yet.'}
              </p>
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
                        disabled={milestoneMutation.isPending || !project.canManage}
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
                      {m.status !== 'PENDING' && m.status !== 'DONE' ? (
                        <Badge variant="outline" className="shrink-0 font-normal capitalize">
                          {m.status.replace(/_/g, ' ').toLowerCase()}
                        </Badge>
                      ) : null}
                      {project.canManage ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 text-muted-foreground"
                          aria-label={`Remove ${m.title}`}
                          disabled={deleteMilestoneMutation.isPending}
                          onClick={() => deleteMilestoneMutation.mutate(m.id)}
                        >
                          <X className="size-4" />
                        </Button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
            {project.canManage ? (
              <form
                className="mt-3 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const title = newMilestone.trim();
                  if (title) addMilestoneMutation.mutate(title);
                }}
              >
                <Input
                  value={newMilestone}
                  onChange={(e) => setNewMilestone(e.target.value)}
                  placeholder="Add a milestone"
                  className="h-9"
                  aria-label="New milestone"
                />
                <Button
                  type="submit"
                  size="sm"
                  variant="outline"
                  className="h-9 shrink-0"
                  disabled={!newMilestone.trim() || addMilestoneMutation.isPending}
                >
                  <Plus className="mr-1 size-4" />
                  Add
                </Button>
              </form>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
