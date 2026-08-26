'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { FullTableSkeleton } from '@/components/loading';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { ListTodo } from 'lucide-react';
import { cn } from '@/lib/utils';

type MyTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  updatedAt: string;
  project: { id: string; name: string };
  parentTask?: { id: string; title: string } | null;
};

const PRIORITY_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  URGENT: 'destructive',
  HIGH: 'destructive',
  MEDIUM: 'secondary',
  LOW: 'outline',
};

function formatDue(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function MyWorkPage() {
  const { path, workspaceFetch, slug } = useWorkspacePaths();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['my-project-tasks', slug],
    queryFn: async () => {
      const res = await workspaceFetch('/api/projects/my-tasks');
      if (!res.ok) throw new Error('Failed to load tasks');
      return res.json() as Promise<MyTask[]>;
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
          Project delivery tasks assigned to you
        </p>
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          icon={ListTodo}
          title="No assigned tasks"
          description="When you are assigned project tasks, they will appear here."
        />
      ) : (
        <div className="grid gap-4">
          {tasks.map((task) => (
            <Card key={task.id} className="transition-colors hover:bg-muted/30">
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <CardTitle className="text-base font-medium">
                    <Link
                      href={path(
                        `/dashboard/projects/${task.project.id}/tasks/${task.id}`
                      )}
                      className="hover:underline"
                    >
                      {task.title}
                    </Link>
                  </CardTitle>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline">{task.status.replace(/_/g, ' ')}</Badge>
                    <Badge variant={PRIORITY_VARIANT[task.priority] ?? 'outline'}>
                      {task.priority}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-muted-foreground">
                <p>
                  Project:{' '}
                  <Link
                    href={path(`/dashboard/projects/${task.project.id}`)}
                    className="text-foreground hover:underline"
                  >
                    {task.project.name}
                  </Link>
                </p>
                {task.parentTask ? (
                  <p className="text-xs">Subtask of {task.parentTask.title}</p>
                ) : null}
                <p className={cn(!task.dueDate && 'opacity-60')}>
                  Due: {formatDue(task.dueDate) ?? 'Not set'}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
