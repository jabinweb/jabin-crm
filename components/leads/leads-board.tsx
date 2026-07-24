'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { PipelineBoard, groupByStage } from '@/components/pipelines/pipeline-board';
import { usePipelineColumns } from '@/hooks/use-pipeline-columns';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { Loader2 } from 'lucide-react';

type LeadCard = {
  id: string;
  stage: string;
  companyName: string;
  contactName?: string | null;
  email?: string | null;
  status: string;
  priority?: string;
};

type LeadsBoardProps = {
  leads: Array<{
    id: string;
    companyName: string;
    contactName?: string | null;
    email?: string | null;
    status: string;
    priority?: string;
  }>;
  onChanged?: () => void;
};

export function LeadsBoard({ leads, onChanged }: LeadsBoardProps) {
  const { columns, loading } = usePipelineColumns('leads');
  const { workspaceFetch, path } = useWorkspacePaths();
  const router = useRouter();
  const [local, setLocal] = useState<LeadCard[] | null>(null);

  const items: LeadCard[] = useMemo(() => {
    const source = local ?? leads.map((l) => ({ ...l, stage: l.status }));
    return source;
  }, [leads, local]);

  const itemsByStage = useMemo(() => groupByStage(items, columns), [items, columns]);

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
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-8">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading board…
      </div>
    );
  }

  if (!columns.length) {
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
          {lead.priority && (
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {lead.priority}
            </p>
          )}
        </button>
      )}
    />
  );
}
