'use client';

import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { PipelineBoard, buildBoardState } from '@/components/pipelines/pipeline-board';
import { usePipelineColumns } from '@/hooks/use-pipeline-columns';
import { BoardSkeleton } from '@/components/loading';
import { useState } from 'react';

type JobTicket = {
  id: string;
  subject: string;
  status: string;
  priority: string;
  stage?: string;
  assignedTechnicianId?: string | null;
  assignedTechnician?: { name?: string | null } | null;
  customer?: { organizationName?: string };
};

const ACTIVE = new Set(['OPEN', 'ASSIGNED', 'IN_PROGRESS']);

export default function ServiceJobBoardPage() {
  const router = useRouter();
  const { slug, path, workspaceFetch } = useWorkspacePaths();
  const queryClient = useQueryClient();
  const { columns: baseColumns, loading: columnsLoading } = usePipelineColumns('tickets');
  const [optimistic, setOptimistic] = useState<Record<string, string>>({});

  const { data: tickets, isLoading } = useQuery({
    queryKey: ['service-job-board', slug],
    queryFn: async () => {
      const response = await workspaceFetch('/api/tickets?limit=200');
      if (!response.ok) throw new Error('Failed to fetch tickets');
      return response.json() as Promise<JobTicket[]>;
    },
  });

  const jobs = useMemo(() => {
    return (tickets ?? []).filter(
      (t) => ACTIVE.has(t.status) || !!t.assignedTechnicianId
    );
  }, [tickets]);

  const boardItems = useMemo(
    () =>
      jobs.map((t) => {
        const stage = optimistic[t.id] ?? t.status;
        return { ...t, status: stage, stage };
      }),
    [jobs, optimistic]
  );
  const { columns, itemsByStage } = useMemo(
    () => buildBoardState(boardItems, baseColumns),
    [boardItems, baseColumns]
  );

  const onMove = async (id: string, toStage: string, fromStage: string) => {
    if (toStage === fromStage) return;
    setOptimistic((prev) => ({ ...prev, [id]: toStage }));
    try {
      const res = await workspaceFetch(`/api/tickets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: toStage }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update job');
      }
      setOptimistic((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      await queryClient.invalidateQueries({ queryKey: ['service-job-board', slug] });
    } catch (error) {
      setOptimistic((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      toast.error(error instanceof Error ? error.message : 'Move failed');
      await queryClient.invalidateQueries({ queryKey: ['service-job-board', slug] });
    }
  };

  return (
    <div className="flex-1 space-y-6">
      <div className="border-b pb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Job board</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Field and assigned service work on the company ticket pipeline.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active jobs</CardTitle>
          <CardDescription>
            Open, assigned, and in-progress tickets, plus any ticket with a technician.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading || columnsLoading ? (
            <BoardSkeleton />
          ) : (
            <PipelineBoard
              columns={columns}
              itemsByStage={itemsByStage}
              onMove={onMove}
              renderCard={(ticket) => (
                <button
                  type="button"
                  className="w-full text-left p-3 space-y-1"
                  onClick={() => router.push(path(`/dashboard/tickets/${ticket.id}`))}
                >
                  <p className="text-sm font-semibold line-clamp-2">{ticket.subject}</p>
                  <p className="text-xs text-muted-foreground">
                    {ticket.customer?.organizationName || 'No customer'}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="secondary" className="text-[10px]">
                      {ticket.priority}
                    </Badge>
                    {ticket.assignedTechnician?.name && (
                      <Badge variant="outline" className="text-[10px]">
                        {ticket.assignedTechnician.name}
                      </Badge>
                    )}
                  </div>
                </button>
              )}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
