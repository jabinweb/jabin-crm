'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { PipelineBoard, buildBoardState } from '@/components/pipelines/pipeline-board';
import { usePipelineColumns } from '@/hooks/use-pipeline-columns';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { BoardSkeleton } from '@/components/loading';

type LeadCard = {
  id: string;
  stage: string;
  companyName: string;
  contactName?: string | null;
  email?: string | null;
  status: string;
  priority?: string;
  revenue?: string | null;
};

type LeadsBoardProps = {
  leads: Array<{
    id: string;
    companyName: string;
    contactName?: string | null;
    email?: string | null;
    status: string;
    priority?: string;
    revenue?: string | null;
  }>;
  onChanged?: () => void;
};

export function LeadsBoard({ leads, onChanged }: LeadsBoardProps) {
  const { columns: baseColumns, loading } = usePipelineColumns('leads');
  const { workspaceFetch, path } = useWorkspacePaths();
  const router = useRouter();
  const [local, setLocal] = useState<LeadCard[] | null>(null);

  const items: LeadCard[] = useMemo(() => {
    const source = local ?? leads.map((l) => ({ ...l, stage: l.status }));
    return source;
  }, [leads, local]);

  const { columns, itemsByStage } = useMemo(
    () => buildBoardState(items, baseColumns),
    [items, baseColumns]
  );

  const onMove = async (id: string, toStage: string, fromStage: string) => {
    if (toStage === fromStage) return;
    const prev = items;
    setLocal(
      items.map((l) => (l.id === id ? { ...l, stage: toStage, status: toStage } : l))
    );
    try {
      const res = await workspaceFetch(`/api/leads/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: toStage }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update status');
      }
      onChanged?.();
    } catch (error) {
      setLocal(prev);
      toast.error(error instanceof Error ? error.message : 'Move failed');
    }
  };

  if (loading) {
    return <BoardSkeleton />;
  }

  if (!baseColumns.length) {
    return <p className="text-sm text-muted-foreground">No lead stages configured.</p>;
  }

  return (
    <PipelineBoard
      columns={columns}
      itemsByStage={itemsByStage}
      onMove={onMove}
      renderCard={(lead) => (
        <button
          type="button"
          className="w-full text-left p-3 space-y-1"
          onClick={() => router.push(path(`/dashboard/leads/${lead.id}`))}
        >
          <p className="text-sm font-semibold">{lead.companyName}</p>
          {lead.contactName && (
            <p className="text-xs text-muted-foreground">{lead.contactName}</p>
          )}
          {lead.email && <p className="text-xs text-muted-foreground truncate">{lead.email}</p>}
          <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
            {lead.priority && <span>{lead.priority}</span>}
            {lead.revenue && (
              <span className="normal-case tabular-nums">{lead.revenue}</span>
            )}
          </div>
        </button>
      )}
    />
  );
}

