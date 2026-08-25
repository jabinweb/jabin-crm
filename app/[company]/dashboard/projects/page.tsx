'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  LayoutGrid,
  List,
  Loader2,
  FolderKanban,
  Plus,
  Search,
  MoreHorizontal,
  ExternalLink,
  Pencil,
  Trash2,
  PauseCircle,
  CheckCircle2,
  CircleDot,
} from 'lucide-react';
import { toast } from 'sonner';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { FullTableSkeleton } from '@/components/loading';
import { cn } from '@/lib/utils';
import {
  PipelineBoard,
  buildBoardState,
} from '@/components/pipelines/pipeline-board';
import { PROJECT_HUB_COLUMNS } from '@/lib/projects/task-board';
import { UNMAPPED_STAGE_ID } from '@/lib/pipelines';

type Project = {
  id: string;
  name: string;
  description: string;
  status: string;
  projectType?: string;
  progress?: number;
  startDate: string;
  endDate: string;
  customerId?: string | null;
  dealId?: string | null;
  customer?: { id: string; organizationName: string } | null;
  deal?: { id: string; title: string } | null;
  pmUser?: { id: string; name: string | null } | null;
  _count?: { milestones?: number; tickets?: number; tasks?: number };
};

const STATUS_META: Record<
  string,
  { label: string; className: string }
> = {
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

function toDateInput(value?: string | null) {
  if (!value) return '';
  return value.slice(0, 10);
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? {
    label: status,
    className: 'bg-muted text-muted-foreground',
  };
  return (
    <Badge variant="outline" className={cn('font-medium', meta.className)}>
      {meta.label}
    </Badge>
  );
}

export default function ProjectsPage() {
  const { slug, path, workspaceFetch } = useWorkspacePaths();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [hubView, setHubView] = useState<'list' | 'board'>('board');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [projectType, setProjectType] = useState('website');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [dealId, setDealId] = useState('');

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects', slug],
    queryFn: async () => {
      const res = await workspaceFetch('/api/projects');
      if (!res.ok) throw new Error('Failed to load projects');
      return (await res.json()) as Project[];
    },
    enabled: !!slug,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['project-customers', slug],
    queryFn: async () => {
      const res = await workspaceFetch('/api/customers?limit=100');
      if (!res.ok) return [];
      const json = await res.json();
      return (json.customers || json || []) as Array<{
        id: string;
        organizationName: string;
      }>;
    },
    enabled: !!slug,
  });

  const { data: deals = [] } = useQuery({
    queryKey: ['project-deals', slug],
    queryFn: async () => {
      const res = await workspaceFetch('/api/deals?limit=100');
      if (!res.ok) return [];
      const json = await res.json();
      return (Array.isArray(json) ? json : json.deals || []) as Array<{
        id: string;
        title: string;
      }>;
    },
    enabled: !!slug,
  });

  const resetForm = () => {
    setName('');
    setDescription('');
    setStatus('ACTIVE');
    setProjectType('website');
    setStartDate('');
    setEndDate('');
    setCustomerId('');
    setDealId('');
    setEditing(null);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (p: Project) => {
    setEditing(p);
    setName(p.name);
    setDescription(p.description || '');
    setStatus(p.status || 'ACTIVE');
    setProjectType(p.projectType || 'website');
    setStartDate(toDateInput(p.startDate));
    setEndDate(toDateInput(p.endDate));
    setCustomerId(p.customerId || p.customer?.id || '');
    setDealId(p.dealId || p.deal?.id || '');
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        description,
        status,
        projectType,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        customerId: customerId || null,
        dealId: dealId || null,
      };
      if (editing) {
        const res = await workspaceFetch(`/api/projects/${editing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to update');
        }
        return res.json();
      }
      const res = await workspaceFetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success(editing ? 'Project updated' : 'Project created');
      resetForm();
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['projects', slug] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await workspaceFetch(`/api/projects/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to delete');
      }
    },
    onSuccess: () => {
      toast.success('Project deleted');
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['projects', slug] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusMoveMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await workspaceFetch(`/api/projects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Failed to update status');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', slug] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.customer?.organizationName?.toLowerCase().includes(q) ||
        p.deal?.title?.toLowerCase().includes(q) ||
        false
      );
    });
  }, [projects, search, statusFilter]);

  const boardItems = useMemo(
    () => filtered.map((p) => ({ ...p, stage: p.status })),
    [filtered]
  );
  const { columns: hubColumns, itemsByStage: hubByStage } = useMemo(
    () => buildBoardState(boardItems, PROJECT_HUB_COLUMNS),
    [boardItems]
  );

  const stats = useMemo(() => {
    const active = projects.filter((p) => p.status === 'ACTIVE').length;
    const onHold = projects.filter((p) => p.status === 'ON_HOLD').length;
    const completed = projects.filter((p) => p.status === 'COMPLETED').length;
    const avgProgress =
      projects.length === 0
        ? 0
        : Math.round(
            projects.reduce((s, p) => s + (p.progress ?? 0), 0) / projects.length
          );
    return { active, onHold, completed, avgProgress, total: projects.length };
  }, [projects]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Plan and track delivery — board and list views for every engagement.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ToggleGroup
            type="single"
            value={hubView}
            onValueChange={(v) => {
              if (v === 'board' || v === 'list') setHubView(v);
            }}
            variant="outline"
            size="sm"
            className="justify-start"
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
          <Button variant="outline" asChild>
            <Link href={path('/dashboard/retainers')}>Retainers</Link>
          </Button>
          <Button onClick={openCreate}>
            <Plus className="mr-2 size-4" />
            New project
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-md bg-emerald-500/10 p-2 text-emerald-700 dark:text-emerald-400">
              <CircleDot className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Active</p>
              <p className="text-xl font-semibold tabular-nums">{stats.active}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-md bg-amber-500/10 p-2 text-amber-700 dark:text-amber-400">
              <PauseCircle className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">On hold</p>
              <p className="text-xl font-semibold tabular-nums">{stats.onHold}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-md bg-blue-500/10 p-2 text-blue-700 dark:text-blue-400">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Completed</p>
              <p className="text-xl font-semibold tabular-nums">{stats.completed}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-md bg-muted p-2 text-muted-foreground">
              <FolderKanban className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Avg. progress</p>
              <p className="text-xl font-semibold tabular-nums">{stats.avgProgress}%</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search projects or clients…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="ON_HOLD">On hold</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <FullTableSkeleton columnCount={6} rowCount={6} />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={FolderKanban}
              title={projects.length === 0 ? 'No projects yet' : 'No matching projects'}
              description={
                projects.length === 0
                  ? 'Create a delivery project or win an opportunity to get started.'
                  : 'Try a different search or status filter.'
              }
              actionLabel={projects.length === 0 ? 'New project' : undefined}
              onAction={projects.length === 0 ? openCreate : undefined}
            />
          ) : hubView === 'board' ? (
            <PipelineBoard
              columns={hubColumns.filter((c) => c.id !== UNMAPPED_STAGE_ID)}
              itemsByStage={hubByStage}
              onMove={(id, toStage) => {
                if (!PROJECT_HUB_COLUMNS.some((c) => c.id === toStage)) return;
                statusMoveMutation.mutate({ id, status: toStage });
              }}
              renderCard={(p) => (
                <div className="group flex flex-col gap-2 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={path(`/dashboard/projects/${p.id}`)}
                      className="block min-w-0 flex-1 text-sm font-medium leading-snug hover:underline underline-offset-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {p.name}
                    </Link>
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
                          <span className="sr-only">Project actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuGroup>
                          <DropdownMenuItem asChild>
                            <Link href={path(`/dashboard/projects/${p.id}`)}>
                              <ExternalLink className="mr-2 size-4" />
                              Open
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEdit(p)}>
                            <Pencil className="mr-2 size-4" />
                            Edit
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeleteTarget(p)}
                        >
                          <Trash2 className="mr-2 size-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  {p.customer ? (
                    <p className="truncate text-xs text-muted-foreground">
                      {p.customer.organizationName}
                    </p>
                  ) : null}
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>Progress</span>
                      <span className="tabular-nums">{p.progress ?? 0}%</span>
                    </div>
                    <Progress value={p.progress ?? 0} className="h-1.5" />
                  </div>
                  {p._count?.tasks ? (
                    <Badge variant="secondary" className="w-fit text-[10px] font-normal">
                      {p._count.tasks} tasks
                    </Badge>
                  ) : null}
                </div>
              )}
            />
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">Project</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead className="w-[140px]">Progress</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden lg:table-cell">Timeline</TableHead>
                    <TableHead className="w-[50px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => (
                    <TableRow key={p.id} className="group">
                      <TableCell>
                        <Link
                          href={path(`/dashboard/projects/${p.id}`)}
                          className="font-medium hover:underline underline-offset-2"
                        >
                          {p.name}
                        </Link>
                        {p.projectType ? (
                          <p className="text-xs text-muted-foreground capitalize mt-0.5">
                            {p.projectType.replace('_', ' ')}
                            {p._count?.milestones
                              ? ` · ${p._count.milestones} milestones`
                              : ''}
                            {p._count?.tasks ? ` · ${p._count.tasks} tasks` : ''}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {p.customer ? (
                          <Link
                            href={path(`/dashboard/customers/${p.customer.id}`)}
                            className="text-sm hover:underline underline-offset-2"
                          >
                            {p.customer.organizationName}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1.5 min-w-[100px]">
                          <div className="flex justify-between text-xs">
                            <span className="tabular-nums text-muted-foreground">
                              {p.progress ?? 0}%
                            </span>
                          </div>
                          <Progress value={p.progress ?? 0} className="h-1.5" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={p.status} />
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                        {formatDate(p.startDate)}
                        <span className="mx-1">→</span>
                        {formatDate(p.endDate)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 opacity-70 group-hover:opacity-100"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuGroup>
                              <DropdownMenuItem asChild>
                                <Link href={path(`/dashboard/projects/${p.id}`)}>
                                  <ExternalLink className="mr-2 size-4" />
                                  Open
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openEdit(p)}>
                                <Pencil className="mr-2 size-4" />
                                Edit
                              </DropdownMenuItem>
                            </DropdownMenuGroup>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setDeleteTarget(p)}
                            >
                              <Trash2 className="mr-2 size-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {!isLoading && filtered.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              Showing {filtered.length} of {stats.total} projects
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit project' : 'New project'}</DialogTitle>
            <DialogDescription>
              {editing
                ? 'Update delivery details for this engagement.'
                : 'Create a delivery project linked to a client.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="proj-name">Name</Label>
              <Input
                id="proj-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sciolabs"
              />
            </div>
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {['ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'].map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_META[s]?.label ?? s}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Type</Label>
              <Select value={projectType} onValueChange={setProjectType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {[
                      ['website', 'Website'],
                      ['webapp', 'Web app'],
                      ['seo', 'SEO / content'],
                      ['branding', 'Branding'],
                      ['retainer', 'Retainer'],
                      ['other', 'Other'],
                    ].map(([v, l]) => (
                      <SelectItem key={v} value={v!}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="proj-desc">Description</Label>
              <Textarea
                id="proj-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Scope, goals, or live URL…"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="proj-start">Start date</Label>
              <Input
                id="proj-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="proj-end">End date</Label>
              <Input
                id="proj-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Client</Label>
              <Select
                value={customerId || '__none__'}
                onValueChange={(v) => setCustomerId(v === '__none__' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="__none__">None</SelectItem>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.organizationName}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Opportunity</Label>
              <Select
                value={dealId || '__none__'}
                onValueChange={(v) => setDealId(v === '__none__' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="__none__">None</SelectItem>
                    {deals.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.title}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={!name.trim() || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending && (
                <Loader2 className="mr-2 size-4 animate-spin" />
              )}
              {editing ? 'Save changes' : 'Create project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `“${deleteTarget.name}” and its tasks will be permanently removed. This cannot be undone.`
                : 'This cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
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
