'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { ListTodo } from 'lucide-react';
import { cn } from '@/lib/utils';

export type DeliveryTaskRow = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  updatedAt?: string;
  project: { id: string; name: string };
  assignee?: { id: string; name: string | null; email: string | null } | null;
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

type Props = {
  tasks: DeliveryTaskRow[];
  path: (href: string) => string;
  emptyTitle?: string;
  emptyDescription?: string;
  showAssignee?: boolean;
};

export function ProjectDeliveryTaskList({
  tasks,
  path,
  emptyTitle = 'No tasks',
  emptyDescription = 'Delivery tasks will appear here.',
  showAssignee = false,
}: Props) {
  if (tasks.length === 0) {
    return (
      <EmptyState
        icon={ListTodo}
        title={emptyTitle}
        description={emptyDescription}
      />
    );
  }

  return (
    <div className="grid gap-3">
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
            {showAssignee ? (
              <p>
                Assignee:{' '}
                {task.assignee?.name || task.assignee?.email || (
                  <span className="italic">Unassigned</span>
                )}
              </p>
            ) : null}
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
  );
}
