'use client';

import { useQuery } from '@tanstack/react-query';
import { FullTableSkeleton } from '@/components/loading';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import {
  ProjectDeliveryTaskList,
  type DeliveryTaskRow,
} from '@/components/projects/project-delivery-task-list';

export default function MyWorkPage() {
  const { path, workspaceFetch, slug } = useWorkspacePaths();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['my-project-tasks', slug],
    queryFn: async () => {
      const res = await workspaceFetch('/api/projects/my-tasks');
      if (!res.ok) throw new Error('Failed to load tasks');
      return res.json() as Promise<DeliveryTaskRow[]>;
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto space-y-6 p-6">
        <FullTableSkeleton columnCount={4} rowCount={6} />
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My work</h1>
        <p className="text-sm text-muted-foreground">
          Open project delivery tasks assigned to you
        </p>
      </div>

      <ProjectDeliveryTaskList
        tasks={tasks}
        path={path}
        emptyTitle="No assigned tasks"
        emptyDescription="When you are assigned project tasks, they will appear here."
      />
    </div>
  );
}
