'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Search, X, AlertTriangle } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { cn } from '@/lib/utils';
import {
  PriorityFilter,
  WORK_TAB_CLASS,
  WorkItemRow,
  WorkListSkeleton,
  WorkSearchInput,
  WorkSection,
  sortWorkItems,
  statusMeta,
  useStoredChoice,
  useTaskStatuses,
  useWorkItemActions,
  type WorkItem,
} from '@/components/projects/work-item-list';
import { ProjectMark, parseDueDate, startOfToday } from '@/components/projects/task-meta';

const GROUPINGS = ['due', 'status', 'project'] as const;
type Grouping = (typeof GROUPINGS)[number];

type Group = {
  key: string;
  title: string;
  items: WorkItem[];
  leading?: ReactNode;
  tone?: 'danger';
};

const DAY = 24 * 60 * 60 * 1000;

/** Jira's "Your work" buckets: what's late, what's today, what's coming. */
function dueBucket(dueDate: string | null): { key: string; title: string; order: number } {
  const due = parseDueDate(dueDate);
  if (!due) return { key: 'none', title: 'No due date', order: 4 };
  const today = startOfToday().getTime();
  const t = due.getTime();
  if (t < today) return { key: 'overdue', title: 'Overdue', order: 0 };
  if (t < today + DAY) return { key: 'today', title: 'Due today', order: 1 };
  if (t < today + 7 * DAY) return { key: 'week', title: 'Next 7 days', order: 2 };
  return { key: 'later', title: 'Later', order: 3 };
}

export default function MyWorkPage() {
  const { path, workspaceFetch, slug } = useWorkspacePaths();
  const queryKey = useMemo(() => ['my-project-tasks', slug], [slug]);

  const { data: tasks = [], isLoading, isError, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await workspaceFetch('/api/projects/my-tasks');
      if (!res.ok) throw new Error('Failed to load tasks');
      return res.json() as Promise<WorkItem[]>;
    },
  });

  const { statuses, doneStatusIds, statusById } = useTaskStatuses();
  const actions = useWorkItemActions(queryKey, statusById);

  const [grouping, setGrouping] = useStoredChoice<Grouping>(
    'opslane.myWork.groupBy',
    'due',
    GROUPINGS
  );
  const [query, setQuery] = useState('');
  const [priority, setPriority] = useState('all');
  const [projectId, setProjectId] = useState('all');
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  const projects = useMemo(() => {
    const byId = new Map<string, { id: string; name: string }>();
    for (const t of tasks) byId.set(t.project.id, t.project);
    return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks]);

  const filtersActive = query.trim() !== '' || priority !== 'all' || projectId !== 'all';
  const clearFilters = () => {
    setQuery('');
    setPriority('all');
    setProjectId('all');
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sortWorkItems(
      tasks.filter((t) => {
        if (
          q &&
          !t.title.toLowerCase().includes(q) &&
          !t.project.name.toLowerCase().includes(q) &&
          !(t.labels ?? []).some((l) => l.label.name.toLowerCase().includes(q))
        ) {
          return false;
        }
        if (priority !== 'all' && t.priority !== priority) return false;
        if (projectId !== 'all' && t.project.id !== projectId) return false;
        return true;
      })
    );
  }, [tasks, query, priority, projectId]);

  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, Group & { order: number }>();
    const add = (key: string, make: () => Omit<Group, 'items'> & { order: number }, t: WorkItem) => {
      let g = map.get(key);
      if (!g) {
        g = { ...make(), items: [] };
        map.set(key, g);
      }
      g.items.push(t);
    };
    for (const t of filtered) {
      if (grouping === 'due') {
        const b = dueBucket(t.dueDate);
        add(b.key, () => ({ key: b.key, title: b.title, order: b.order, tone: b.key === 'overdue' ? 'danger' : undefined }), t);
      } else if (grouping === 'status') {
        const s = statusMeta(statusById, t.status);
        const idx = statuses.findIndex((x) => x.id === t.status);
        add(s.id, () => ({
          key: s.id,
          title: s.label,
          order: idx === -1 ? statuses.length : idx,
          leading: <span className={cn('h-2 w-2 shrink-0 rounded-full', s.color)} aria-hidden />,
        }), t);
      } else {
        add(t.project.id, () => ({
          key: t.project.id,
          title: t.project.name,
          order: 0,
          leading: <ProjectMark project={t.project} />,
        }), t);
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      a.order - b.order || a.title.localeCompare(b.title)
    );
  }, [filtered, grouping, statuses, statusById]);

  const overdueCount = useMemo(
    () => tasks.filter((t) => dueBucket(t.dueDate).key === 'overdue').length,
    [tasks]
  );
  const todayCount = useMemo(
    () => tasks.filter((t) => dueBucket(t.dueDate).key === 'today').length,
    [tasks]
  );

  const toggle = (key: string) =>
    setCollapsed((cur) => {
      const next = new Set(cur);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  let body: ReactNode;
  if (isLoading) {
    body = <WorkListSkeleton sections={3} rows={3} />;
  } else if (isError) {
    body = (
      <EmptyState
        icon={AlertTriangle}
        title="Couldn't load your work"
        description="Something went wrong fetching your tasks. Try again in a moment."
        actionLabel="Retry"
        onAction={() => void refetch()}
        className="rounded-lg border border-dashed"
      />
    );
  } else if (tasks.length === 0) {
    body = (
      <EmptyState
        icon={CheckCircle2}
        title="You're all caught up"
        description="Nothing open is assigned to you. Pick something up from the backlog, or ask your project lead to assign you work."
        actionLabel="Browse the backlog"
        actionHref={path('/dashboard/projects/backlog')}
        className="rounded-lg border border-dashed"
      />
    );
  } else if (filtered.length === 0) {
    body = (
      <EmptyState
        icon={Search}
        title="No tasks match these filters"
        description="Try a different search or clear the filters."
        actionLabel="Clear filters"
        onAction={clearFilters}
        className="rounded-lg border border-dashed"
      />
    );
  } else {
    body = (
      <div className="space-y-4">
        {groups.map((g) => (
          <WorkSection
            key={`${grouping}:${g.key}`}
            title={g.title}
            count={g.items.length}
            leading={g.leading}
            tone={g.tone}
            collapsed={collapsed.has(`${grouping}:${g.key}`)}
            onToggle={() => toggle(`${grouping}:${g.key}`)}
          >
            {g.items.map((t) => (
              <WorkItemRow
                key={t.id}
                task={t}
                statuses={statuses}
                statusById={statusById}
                doneStatusIds={doneStatusIds}
                actions={actions}
                showProject={grouping !== 'project'}
              />
            ))}
          </WorkSection>
        ))}
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-5">
      {/* Static header: renders immediately; only the list below waits for data */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">My work</h1>
          <p className="text-sm text-muted-foreground">
            Open tasks assigned to you, across every project
          </p>
        </div>
        {!isLoading && tasks.length > 0 ? (
          <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground tabular-nums">
            <span>
              <span className="font-medium text-foreground">{tasks.length}</span> open
            </span>
            {overdueCount > 0 ? (
              <>
                <span aria-hidden>·</span>
                <span className="font-medium text-destructive">{overdueCount} overdue</span>
              </>
            ) : null}
            {todayCount > 0 ? (
              <>
                <span aria-hidden>·</span>
                <span>
                  <span className="font-medium text-foreground">{todayCount}</span> due today
                </span>
              </>
            ) : null}
          </p>
        ) : null}
      </div>

      {/* Nothing assigned: the filters have nothing to act on, so the empty state stands alone */}
      {isLoading || isError || tasks.length > 0 ? (
        <>
          <Tabs value={grouping} onValueChange={(v) => setGrouping(v as Grouping)}>
            <TabsList className="h-auto w-full justify-start gap-5 rounded-none border-0 border-b bg-transparent p-0 sm:justify-start">
              <TabsTrigger value="due" className={WORK_TAB_CLASS}>
                By due date
              </TabsTrigger>
              <TabsTrigger value="status" className={WORK_TAB_CLASS}>
                By status
              </TabsTrigger>
              <TabsTrigger value="project" className={WORK_TAB_CLASS}>
                By project
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <WorkSearchInput value={query} onChange={setQuery} placeholder="Search my work" />
            {/* Phones: one swipeable row of filters instead of a tall wrapped stack */}
            <div className="no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4 py-0.5 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&>*]:shrink-0">
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger className="h-9 w-[180px] max-w-full" aria-label="Filter by project">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">All projects</SelectItem>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <PriorityFilter value={priority} onChange={setPriority} />
              {filtersActive ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-9 text-muted-foreground"
                  onClick={clearFilters}
                >
                  <X className="mr-1 h-3.5 w-3.5" />
                  Clear filters
                </Button>
              ) : null}
            </div>
          </div>
        </>
      ) : null}

      {body}
    </div>
  );
}
