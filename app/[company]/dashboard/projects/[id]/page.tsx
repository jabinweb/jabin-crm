'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, ArrowLeft, CheckCircle2, Circle, PlayCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';

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

const statusIcon = (status: string) => {
  if (status === 'DONE') return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  if (status === 'IN_PROGRESS') return <PlayCircle className="h-4 w-4 text-blue-600" />;
  return <Circle className="h-4 w-4 text-muted-foreground" />;
};

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const { slug, path, workspaceFetch } = useWorkspacePaths();
  const queryClient = useQueryClient();
  const [milestoneTitle, setMilestoneTitle] = useState('');

  const { data: project, isLoading } = useQuery({
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

  if (isLoading || !project) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
            <Link href={path('/dashboard/projects')}>
              <ArrowLeft className="mr-1 h-4 w-4" /> All projects
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            {project.description || 'No description'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant="secondary">{project.status}</Badge>
            <Badge variant="outline">{project.projectType}</Badge>
            {project.customer && (
              <Badge variant="outline">{project.customer.organizationName}</Badge>
            )}
            {project.deal && (
              <Badge variant="outline">From: {project.deal.title}</Badge>
            )}
          </div>
        </div>
        <div className="w-full max-w-xs space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{project.progress}%</span>
          </div>
          <Progress value={project.progress} />
          <p className="text-xs text-muted-foreground">
            {(project.hoursLogged ?? 0).toFixed(1)} hrs logged
            {project.pmUser?.name ? ` · PM: ${project.pmUser.name}` : ''}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Milestones</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {project.milestones.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() =>
                  updateMilestone.mutate({ id: m.id, status: cycleStatus(m.status) })
                }
                className="flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left text-sm hover:bg-muted/50"
              >
                {statusIcon(m.status)}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{m.title}</p>
                  <p className="text-xs text-muted-foreground">{m.status.replace('_', ' ')}</p>
                </div>
              </button>
            ))}
            <div className="flex gap-2 pt-2">
              <Input
                placeholder="New milestone"
                value={milestoneTitle}
                onChange={(e) => setMilestoneTitle(e.target.value)}
              />
              <Button
                disabled={!milestoneTitle.trim() || addMilestone.isPending}
                onClick={() => addMilestone.mutate()}
              >
                Add
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Client requests</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {project.tickets.length === 0 ? (
              <p className="text-sm text-muted-foreground">No linked requests yet.</p>
            ) : (
              project.tickets.map((t) => (
                <Link
                  key={t.id}
                  href={path(`/dashboard/tickets/${t.id}`)}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm hover:bg-muted/50"
                >
                  <span className="truncate font-medium">{t.subject}</span>
                  <Badge variant="outline">{t.status}</Badge>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Retainers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {project.retainers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No retainers on this project.{' '}
                <Link href={path('/dashboard/retainers')} className="underline">
                  Manage retainers
                </Link>
              </p>
            ) : (
              project.retainers.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium">{r.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.currency} {r.amount} / {r.billingCycle.toLowerCase()}
                    </p>
                  </div>
                  <Badge>{r.status}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Team</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {project.pmUser && (
              <div className="rounded-md border px-3 py-2 text-sm">
                <p className="font-medium">{project.pmUser.name || project.pmUser.email}</p>
                <p className="text-xs text-muted-foreground">Project lead</p>
              </div>
            )}
            {project.members.map((m) => (
              <div key={m.id} className="rounded-md border px-3 py-2 text-sm">
                <p className="font-medium">{m.user.name || m.user.email}</p>
                <p className="text-xs text-muted-foreground">{m.role}</p>
              </div>
            ))}
            {!project.pmUser && project.members.length === 0 && (
              <p className="text-sm text-muted-foreground">No team assigned yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
