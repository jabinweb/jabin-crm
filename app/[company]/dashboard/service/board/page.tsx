'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { PipelineBoard, buildBoardState } from '@/components/pipelines/pipeline-board';
import { usePipelineColumns } from '@/hooks/use-pipeline-columns';
import { BoardSkeleton } from '@/components/loading';

type JobTicket = {
  id: string;
  subject: string;
  status: string;
  priority: string;
  stage: string;
  scheduledFor?: string | null;
  estimatedDurationMin?: number | null;
  assignedTechnicianId?: string | null;
  assignedTechnician?: { id?: string; name?: string | null } | null;
  customer?: { organizationName?: string };
};

type Tech = { id: string; name: string };

const ACTIVE = new Set(['OPEN', 'ASSIGNED', 'IN_PROGRESS']);

type BoardView = 'status' | 'technician' | 'day';

function dayKey(iso?: string | null) {
  if (!iso) return 'unscheduled';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'unscheduled';
  return d.toISOString().slice(0, 10);
}

export default function ServiceJobBoardPage() {
  const router = useRouter();
  const { slug, path, workspaceFetch } = useWorkspacePaths();
  const queryClient = useQueryClient();
  const { columns: baseColumns, loading: columnsLoading } = usePipelineColumns('tickets');
  const [optimistic, setOptimistic] = useState<Record<string, string>>({});
  const [view, setView] = useState<BoardView>('status');
  const [dayFilter, setDayFilter] = useState(() => new Date().toISOString().slice(0, 10));

  const { data: tickets, isLoading } = useQuery({
    queryKey: ['service-job-board', slug],
    queryFn: async () => {
      const response = await workspaceFetch('/api/tickets?limit=200');
      if (!response.ok) throw new Error('Failed to fetch tickets');
      return response.json() as Promise<JobTicket[]>;
    },
  });

  const { data: technicians = [] } = useQuery({
    queryKey: ['technicians-board'],
    queryFn: async () => {
      const response = await workspaceFetch('/api/users/technicians');
      if (!response.ok) return [];
      return response.json() as Promise<Tech[]>;
    },
  });

  const jobs = useMemo(() => {
    return (tickets ?? [])
      .filter((t) => ACTIVE.has(t.status) || !!t.assignedTechnicianId || !!t.scheduledFor)
      .map((t) => ({ ...t, stage: t.status }));
  }, [tickets]);

  const boardItems = useMemo(
    () =>
      jobs.map((t) => {
        const stage = optimistic[t.id] ?? t.status;
        return { ...t, status: stage, stage };
      }),
    [jobs, optimistic]
  );

  const statusBoard = useMemo(
    () => buildBoardState(boardItems, baseColumns),
    [boardItems, baseColumns]
  );

  const techColumns = useMemo(() => {
    const cols: Array<{ id: string; label: string; color: string }> = [
      { id: 'unassigned', label: 'Unassigned', color: '#94a3b8' },
      ...technicians.map((t) => ({
        id: t.id,
        label: t.name || 'Technician',
        color: '#3b82f6',
      })),
    ];
    const itemsByStage: Record<string, Array<JobTicket & { stage: string }>> = {
      unassigned: [],
    };
    for (const t of technicians) itemsByStage[t.id] = [];
    for (const job of boardItems) {
      const key = job.assignedTechnicianId || 'unassigned';
      if (!itemsByStage[key]) itemsByStage[key] = [];
      itemsByStage[key].push({ ...job, stage: key });
    }
    return { columns: cols, itemsByStage };
  }, [boardItems, technicians]);

  const dayJobs = useMemo(() => {
    return boardItems.filter((j) => dayKey(j.scheduledFor) === dayFilter);
  }, [boardItems, dayFilter]);

  const onMoveStatus = async (id: string, toStage: string, fromStage: string) => {
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

  const onMoveTech = async (id: string, toStage: string, fromStage: string) => {
    if (toStage === fromStage) return;
    try {
      const res = await workspaceFetch(`/api/tickets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignedTechnicianId: toStage === 'unassigned' ? null : toStage,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to assign');
      }
      await queryClient.invalidateQueries({ queryKey: ['service-job-board', slug] });
      toast.success('Technician updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Assign failed');
    }
  };

  const scheduleTicket = async (id: string, scheduledFor: string) => {
    try {
      const res = await workspaceFetch(`/api/tickets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledFor: scheduledFor || null }),
      });
      if (!res.ok) throw new Error('Failed to schedule');
      await queryClient.invalidateQueries({ queryKey: ['service-job-board', slug] });
      toast.success('Schedule updated');
    } catch {
      toast.error('Failed to schedule');
    }
  };

  const renderCard = (ticket: JobTicket) => (
    <div className="w-full text-left p-3 space-y-2">
      <button
        type="button"
        className="w-full text-left space-y-1"
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
      <Input
        type="datetime-local"
        className="h-8 text-xs"
        value={
          ticket.scheduledFor
            ? new Date(ticket.scheduledFor).toISOString().slice(0, 16)
            : ''
        }
        onChange={(e) => scheduleTicket(ticket.id, e.target.value)}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );

  return (
    <div className="flex-1 space-y-6">
      <div className="border-b pb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Job board</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Status pipeline, technician dispatch, and day schedule.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={view === 'status' ? 'default' : 'outline'}
            onClick={() => setView('status')}
          >
            By status
          </Button>
          <Button
            size="sm"
            variant={view === 'technician' ? 'default' : 'outline'}
            onClick={() => setView('technician')}
          >
            By technician
          </Button>
          <Button
            size="sm"
            variant={view === 'day' ? 'default' : 'outline'}
            onClick={() => setView('day')}
          >
            Day strip
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {view === 'status'
              ? 'Active jobs'
              : view === 'technician'
                ? 'Dispatch by technician'
                : 'Scheduled for day'}
          </CardTitle>
          <CardDescription>
            {view === 'day'
              ? 'Filter by scheduled date. Unscheduled jobs appear under other views.'
              : 'Drag cards to update status or assignment. Set schedule on each card.'}
          </CardDescription>
          {view === 'day' ? (
            <Input
              type="date"
              className="mt-2 w-[200px]"
              value={dayFilter}
              onChange={(e) => setDayFilter(e.target.value)}
            />
          ) : null}
        </CardHeader>
        <CardContent>
          {isLoading || columnsLoading ? (
            <BoardSkeleton />
          ) : view === 'status' ? (
            <PipelineBoard
              columns={statusBoard.columns}
              itemsByStage={statusBoard.itemsByStage}
              onMove={onMoveStatus}
              renderCard={renderCard}
            />
          ) : view === 'technician' ? (
            <PipelineBoard
              columns={techColumns.columns}
              itemsByStage={techColumns.itemsByStage}
              onMove={onMoveTech}
              renderCard={renderCard}
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {dayJobs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No jobs scheduled for this day.</p>
              ) : (
                dayJobs.map((ticket) => (
                  <Card key={ticket.id}>{renderCard(ticket)}</Card>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
