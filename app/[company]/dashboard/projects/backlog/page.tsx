'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FullTableSkeleton } from '@/components/loading';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import {
  ProjectDeliveryTaskList,
  type DeliveryTaskRow,
} from '@/components/projects/project-delivery-task-list';

type ProjectOption = { id: string; name: string };

export default function ProjectBacklogPage() {
  const { path, workspaceFetch, slug } = useWorkspacePaths();
  const [projectId, setProjectId] = useState('all');
  const [assignee, setAssignee] = useState('all');
  const [status, setStatus] = useState('open');

  const queryKey = useMemo(
    () => ['project-backlog', slug, projectId, assignee, status],
    [slug, projectId, assignee, status]
  );

  const { data: tasks = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (projectId !== 'all') params.set('projectId', projectId);
      if (assignee !== 'all') params.set('assignee', assignee);
      if (status === 'open') {
        /* default: exclude DONE */
      } else if (status === 'all') {
        params.set('includeDone', '1');
      } else {
        params.set('status', status);
      }
      const res = await workspaceFetch(`/api/projects/backlog?${params}`);
      if (!res.ok) throw new Error('Failed to load backlog');
      return res.json() as Promise<DeliveryTaskRow[]>;
    },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects-options', slug],
    queryFn: async () => {
      const res = await workspaceFetch('/api/projects');
      if (!res.ok) return [] as ProjectOption[];
      const json = await res.json();
      const list = Array.isArray(json) ? json : json.data || [];
      return list.map((p: { id: string; name: string }) => ({
        id: p.id,
        name: p.name,
      })) as ProjectOption[];
    },
  });

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Backlog</h1>
        <p className="text-sm text-muted-foreground">
          Open delivery work across all projects
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={projectId} onValueChange={setProjectId}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Project" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All projects</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={assignee} onValueChange={setAssignee}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Assignee" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Anyone</SelectItem>
            <SelectItem value="me">Assigned to me</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
          </SelectContent>
        </Select>

        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Open only</SelectItem>
            <SelectItem value="TODO">To do</SelectItem>
            <SelectItem value="IN_PROGRESS">In progress</SelectItem>
            <SelectItem value="IN_REVIEW">In review</SelectItem>
            <SelectItem value="BACKLOG">Backlog</SelectItem>
            <SelectItem value="all">Include done</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <FullTableSkeleton columnCount={4} rowCount={6} />
      ) : (
        <ProjectDeliveryTaskList
          tasks={tasks}
          path={path}
          showAssignee
          emptyTitle="Backlog is clear"
          emptyDescription="No open project tasks match these filters."
        />
      )}
    </div>
  );
}
