'use client';

import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Inbox, Plus, Search, X } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { UserAvatar } from '@/components/ui/user-avatar';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { cn } from '@/lib/utils';
import {
  PriorityFilter,
  QuickCreateRow,
  StatusBreakdown,
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
import { ProjectMark } from '@/components/projects/task-meta';

type ProjectOption = { id: string; name: string; status?: string };

const GROUPINGS = ['project', 'status'] as const;
type Grouping = (typeof GROUPINGS)[number];

/** The backlog API returns at most this many rows (lib/projects/my-tasks-query). */
const BACKLOG_LIMIT = 200;

type Group = {
  key: string;
  title: ReactNode;
  items: WorkItem[];
  leading?: ReactNode;
  projectId?: string;
};

export default function ProjectBacklogPage() {
  const { path, workspaceFetch, slug } = useWorkspacePaths();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const myId = session?.user?.id;

  // Server-side scope (keeps the 200-row window relevant)
  const [projectId, setProjectId] = useState('all');
  const [scope, setScope] = useState('open');
  // Client-side refinements
  const [query, setQuery] = useState('');
  const [priority, setPriority] = useState('all');
  const [people, setPeople] = useState<string[]>([]);
  const [mineOnly, setMineOnly] = useState(false);
  const [grouping, setGrouping] = useStoredChoice<Grouping>(
    'opslane.backlog.groupBy',
    'project',
    GROUPINGS
  );
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [creating, setCreating] = useState(false);

  const queryKey = useMemo(
    () => ['project-backlog', slug, projectId, scope],
    [slug, projectId, scope]
  );

  const { data: tasks = [], isLoading, isError, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (projectId !== 'all') params.set('projectId', projectId);
      if (scope === 'all') params.set('includeDone', '1');
      else if (scope !== 'open') params.set('status', scope);
      const res = await workspaceFetch(`/api/projects/backlog?${params}`);
      if (!res.ok) throw new Error('Failed to load backlog');
      return res.json() as Promise<WorkItem[]>;
    },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects-options', slug],
    queryFn: async () => {
      const res = await workspaceFetch('/api/projects');
      if (!res.ok) return [] as ProjectOption[];
      const json = await res.json();
      const list = Array.isArray(json) ? json : json.data || [];
      return (list as ProjectOption[])
        .map((p) => ({ id: p.id, name: p.name, status: p.status }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
  });
  // New work only goes to live projects
  const creatableProjects = useMemo(
    () => projects.filter((p) => p.status !== 'COMPLETED' && p.status !== 'CANCELLED'),
    [projects]
  );

  const { statuses, doneStatusIds, statusById } = useTaskStatuses();
  const actions = useWorkItemActions(queryKey, statusById);

  const assignees = useMemo(() => {
    const byId = new Map<string, NonNullable<WorkItem['assignee']>>();
    for (const t of tasks) if (t.assignee) byId.set(t.assignee.id, t.assignee);
    return Array.from(byId.values()).sort((a, b) =>
      (a.name || a.email || '').localeCompare(b.name || b.email || '')
    );
  }, [tasks]);
  const hasUnassigned = tasks.some((t) => !t.assignee);

  const filtersActive =
    query.trim() !== '' ||
    priority !== 'all' ||
    people.length > 0 ||
    mineOnly ||
    projectId !== 'all' ||
    scope !== 'open';
  const clearFilters = () => {
    setQuery('');
    setPriority('all');
    setPeople([]);
    setMineOnly(false);
    setProjectId('all');
    setScope('open');
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
        if (mineOnly && t.assignee?.id !== myId) return false;
        if (people.length > 0 && !people.includes(t.assignee?.id ?? '__none__')) return false;
        return true;
      })
    );
  }, [tasks, query, priority, mineOnly, myId, people]);

  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, Group & { order: number; sortName: string }>();
    for (const t of filtered) {
      const key = grouping === 'project' ? t.project.id : t.status;
      let g = map.get(key);
      if (!g) {
        if (grouping === 'project') {
          g = {
            key,
            title: t.project.name,
            sortName: t.project.name,
            order: 0,
            projectId: t.project.id,
            leading: <ProjectMark project={t.project} />,
            items: [],
          };
        } else {
          const s = statusMeta(statusById, t.status);
          const idx = statuses.findIndex((x) => x.id === t.status);
          g = {
            key,
            title: s.label,
            sortName: s.label,
            order: idx === -1 ? statuses.length : idx,
            leading: <span className={cn('h-2 w-2 shrink-0 rounded-full', s.color)} aria-hidden />,
            items: [],
          };
        }
        map.set(key, g);
      }
      g.items.push(t);
    }
    // A filtered-to project with nothing open still gets its section, so you can add to it
    if (grouping === 'project' && projectId !== 'all' && !map.has(projectId) && !isLoading) {
      const p = projects.find((x) => x.id === projectId);
      if (p) {
        map.set(p.id, {
          key: p.id,
          title: p.name,
          sortName: p.name,
          order: 0,
          projectId: p.id,
          leading: <ProjectMark project={p} />,
          items: [],
        });
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => a.order - b.order || a.sortName.localeCompare(b.sortName)
    );
  }, [filtered, grouping, statuses, statusById, projectId, projects, isLoading]);

  const toggle = (key: string) =>
    setCollapsed((cur) => {
      const next = new Set(cur);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const onCreated = (createdIn: string) => {
    void queryClient.invalidateQueries({ queryKey: ['project-backlog', slug] });
    void queryClient.invalidateQueries({ queryKey: ['project', slug, createdIn] });
    void queryClient.invalidateQueries({ queryKey: ['projects', slug] });
  };

  const togglePerson = (id: string) =>
    setPeople((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  let body: ReactNode;
  if (isLoading) {
    body = <WorkListSkeleton sections={2} rows={5} />;
  } else if (isError) {
    body = (
      <EmptyState
        icon={AlertTriangle}
        title="Couldn't load the backlog"
        description="Something went wrong fetching tasks. Try again in a moment."
        actionLabel="Retry"
        onAction={() => void refetch()}
        className="rounded-lg border border-dashed"
      />
    );
  } else if (groups.length === 0) {
    body =
      tasks.length > 0 || filtersActive ? (
        <EmptyState
          icon={Search}
          title="No tasks match these filters"
          description="Try a different search, widen the status, or clear the filters."
          actionLabel="Clear filters"
          onAction={clearFilters}
          className="rounded-lg border border-dashed"
        />
      ) : (
        <EmptyState
          icon={Inbox}
          title="The backlog is clear"
          description="No open tasks in any project. Capture the next piece of work so it doesn't get lost."
          actionLabel={creatableProjects.length > 0 ? 'Create task' : undefined}
          onAction={() => setCreating(true)}
          className="rounded-lg border border-dashed"
        />
      );
  } else {
    body = (
      <div className="space-y-4">
        {groups.map((g) => {
          const key = `${grouping}:${g.key}`;
          return (
            <WorkSection
              key={key}
              title={g.title}
              count={g.items.length}
              leading={g.leading}
              collapsed={collapsed.has(key)}
              onToggle={() => toggle(key)}
              trailing={
                g.projectId ? (
                  <div className="flex shrink-0 items-center gap-3">
                    <StatusBreakdown
                      tasks={g.items}
                      statuses={statuses}
                      className="hidden sm:flex"
                    />
                    <Link
                      href={path(`/dashboard/projects/${g.projectId}`)}
                      className="rounded px-1.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      Board
                    </Link>
                  </div>
                ) : null
              }
              footer={
                g.projectId && creatableProjects.some((p) => p.id === g.projectId) ? (
                  <QuickCreateRow
                    projectId={g.projectId}
                    projects={projects}
                    onCreated={onCreated}
                  />
                ) : undefined
              }
            >
              {g.items.length === 0 ? (
                <li className="px-3 py-4 text-sm text-muted-foreground">
                  Nothing open here. Add the first task below.
                </li>
              ) : (
                g.items.map((t) => (
                  <WorkItemRow
                    key={t.id}
                    task={t}
                    statuses={statuses}
                    statusById={statusById}
                    doneStatusIds={doneStatusIds}
                    actions={actions}
                    showProject={grouping !== 'project'}
                    showAssignee
                  />
                ))
              )}
            </WorkSection>
          );
        })}
        {tasks.length >= BACKLOG_LIMIT ? (
          <p className="text-center text-xs text-muted-foreground">
            Showing the first {BACKLOG_LIMIT} tasks. Pick a project to see the rest.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-5">
      {/* Static header: renders immediately; only the list below waits for data */}
      <div className="flex items-start justify-between gap-3 sm:items-end sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Backlog</h1>
          <p className="text-sm text-muted-foreground">
            Every open task across your projects — triage, prioritise and pick up work
          </p>
        </div>
        <Button
          size="sm"
          className="h-9 shrink-0"
          onClick={() => setCreating(true)}
          disabled={creating}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Create task
        </Button>
      </div>

      <Tabs value={grouping} onValueChange={(v) => setGrouping(v as Grouping)}>
        <TabsList className="h-auto w-full justify-start gap-5 rounded-none border-0 border-b bg-transparent p-0 sm:justify-start">
          <TabsTrigger value="project" className={WORK_TAB_CLASS}>
            By project
          </TabsTrigger>
          <TabsTrigger value="status" className={WORK_TAB_CLASS}>
            By status
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <WorkSearchInput value={query} onChange={setQuery} placeholder="Search backlog" />
        {/* Phones: one swipeable row of filters instead of a tall wrapped stack */}
        <div className="no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4 py-0.5 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&>*]:shrink-0">
          {assignees.length > 0 || hasUnassigned ? (
            <div className="flex items-center pl-1" role="group" aria-label="Filter by assignee">
              {assignees.slice(0, 8).map((p) => {
                const active = people.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    title={p.name || p.email || ''}
                    aria-label={`Filter by ${p.name || p.email}`}
                    aria-pressed={active}
                    onClick={() => togglePerson(p.id)}
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
                  aria-label="Filter unassigned tasks"
                  aria-pressed={people.includes('__none__')}
                  onClick={() => togglePerson('__none__')}
                  className={cn(
                    '-ml-1 h-8 w-8 rounded-full border border-dashed border-muted-foreground/50 bg-background ring-2 hover:z-10',
                    people.includes('__none__') ? 'z-10 ring-primary' : 'ring-background'
                  )}
                />
              ) : null}
            </div>
          ) : null}

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

          <Select value={scope} onValueChange={setScope}>
            <SelectTrigger className="h-9 w-[150px]" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="open">All open</SelectItem>
                <SelectItem value="all">Include done</SelectItem>
              </SelectGroup>
              <SelectSeparator />
              <SelectGroup>
                <SelectLabel className="text-xs font-normal text-muted-foreground">
                  Only
                </SelectLabel>
                {statuses.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    <span className="inline-flex items-center gap-2">
                      <span className={cn('h-2 w-2 rounded-full', s.color)} aria-hidden />
                      {s.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          <PriorityFilter value={priority} onChange={setPriority} />

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

      {creating ? (
        <div className="rounded-lg border bg-card">
          <QuickCreateRow
            defaultOpen
            projects={creatableProjects}
            projectId={
              projectId !== 'all' && creatableProjects.some((p) => p.id === projectId)
                ? projectId
                : undefined
            }
            onCreated={onCreated}
            onCancel={() => setCreating(false)}
          />
        </div>
      ) : null}

      {body}
    </div>
  );
}
