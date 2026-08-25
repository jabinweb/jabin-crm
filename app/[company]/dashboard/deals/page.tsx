'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, DollarSign, TrendingUp, Award } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { useCurrency } from '@/hooks/use-currency';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { usePipelineColumns } from '@/hooks/use-pipeline-columns';
import { PipelineBoard, buildBoardState } from '@/components/pipelines/pipeline-board';
import { toast } from 'sonner';
import { DashboardPage } from '@/components/layout/dashboard-page';
import { BoardSkeleton, PageHeaderSkeleton, StatCardsSkeleton } from '@/components/loading';
import { useRealtime } from '@/hooks/use-realtime';
import { REALTIME_EVENTS } from '@/lib/realtime/events';
import { useWorkspaceTerminology } from '@/hooks/use-workspace-config';

type Deal = {
  id: string;
  title: string;
  value: number;
  currency: string;
  stage: string;
  probability: number;
  lead: {
    id?: string;
    companyName: string;
    contactName?: string;
  };
};

type LeadOption = {
  id: string;
  companyName: string;
  contactName?: string | null;
};

type PipelineStats = {
  stages: Array<{ stage: string; count: number; totalValue: number }>;
  totalValue: number;
  weightedValue: number;
};

const EMPTY_FORM = {
  title: '',
  value: '',
  leadId: '',
  probability: '50',
  stage: 'PROSPECTING',
};

export default function DealsPage() {
  const { workspaceFetch, path } = useWorkspacePaths();
  const { columns: baseColumns, loading: columnsLoading } = usePipelineColumns('deals');
  const [deals, setDeals] = useState<Deal[]>([]);
  const [stats, setStats] = useState<PipelineStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const { formatCurrency } = useCurrency();
  const terminology = useWorkspaceTerminology();

  useRealtime({
    types: [REALTIME_EVENTS.BOARD_MOVED],
    onEvent: (e) => {
      if (e.payload?.entity !== 'deals') return;
      void (async () => {
        const res = await workspaceFetch('/api/deals');
        if (res.ok) {
          const data = await res.json();
          setDeals(Array.isArray(data) ? data : data.deals || []);
        }
      })();
    },
  });

  const fetchDeals = useCallback(async () => {
    try {
      const res = await workspaceFetch('/api/deals');
      if (res.ok) {
        setDeals(await res.json());
      }
    } catch {
      toast.error('Failed to load deals');
    } finally {
      setLoading(false);
    }
  }, [workspaceFetch]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await workspaceFetch('/api/deals/stats');
      if (res.ok) setStats(await res.json());
    } catch {
      /* ignore */
    }
  }, [workspaceFetch]);

  useEffect(() => {
    void fetchDeals();
    void fetchStats();
  }, [fetchDeals, fetchStats]);

  const openCreate = async () => {
    setForm(EMPTY_FORM);
    setCreateOpen(true);
    try {
      const res = await workspaceFetch('/api/leads?limit=100');
      if (!res.ok) return;
      const data = await res.json();
      const list = Array.isArray(data) ? data : data.leads || data.data || [];
      setLeads(
        list.map((l: LeadOption) => ({
          id: l.id,
          companyName: l.companyName,
          contactName: l.contactName,
        }))
      );
    } catch {
      toast.error('Failed to load leads');
    }
  };

  const createDeal = async () => {
    if (!form.title.trim() || !form.leadId || !form.value) {
      toast.error('Title, lead, and value are required');
      return;
    }
    setCreating(true);
    try {
      const res = await workspaceFetch('/api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          leadId: form.leadId,
          value: Number(form.value),
          probability: Number(form.probability) || 50,
          stage: form.stage,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create deal');
      }
      toast.success('Deal created');
      setCreateOpen(false);
      void fetchDeals();
      void fetchStats();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create deal');
    } finally {
      setCreating(false);
    }
  };

  const { columns, itemsByStage } = useMemo(
    () => buildBoardState(deals, baseColumns),
    [deals, baseColumns]
  );

  const onMove = async (id: string, toStage: string, fromStage: string) => {
    if (toStage === fromStage) return;
    const prev = deals;
    setDeals((list) => list.map((d) => (d.id === id ? { ...d, stage: toStage } : d)));
    try {
      const res = await workspaceFetch(`/api/deals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: toStage }),
      });
      if (!res.ok) throw new Error('Failed to update deal');
      void workspaceFetch('/api/realtime/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity: 'deals', id, from: fromStage, to: toStage }),
      });
      void fetchStats();
    } catch {
      setDeals(prev);
      toast.error('Could not move deal');
      void fetchDeals();
    }
  };

  if (loading || columnsLoading) {
    return (
      <DashboardPage>
        <PageHeaderSkeleton />
        <StatCardsSkeleton count={3} />
        <BoardSkeleton />
      </DashboardPage>
    );
  }

  return (
    <DashboardPage>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {terminology?.deals ?? 'Deal'} pipeline
          </h1>
          <p className="text-sm text-muted-foreground">
            Track {terminology?.deals?.toLowerCase() ?? 'deals'} through your sales process
          </p>
        </div>
        <Button onClick={() => void openCreate()}>
          <Plus className="mr-2 h-4 w-4" />
          New {terminology?.deal?.toLowerCase() ?? 'deal'}
        </Button>
      </div>

      {stats && (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total pipeline</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.totalValue)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Weighted value</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.weightedValue)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active deals</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.stages?.reduce((sum, s) => sum + s.count, 0) ?? 0}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <PipelineBoard
        columns={columns}
        itemsByStage={itemsByStage}
        onMove={onMove}
        emptyState={
          <EmptyState
            icon={Award}
            title="No deals yet"
            description="Create a deal from a lead or add one to start the pipeline."
            actionLabel="New deal"
            actionHref={path('/dashboard/deals/new')}
            className="rounded-lg border border-dashed py-16"
          />
        }
        columnFooter={(stageId) =>
          stats ? (
            <p className="text-xs text-muted-foreground mb-2">
              {formatCurrency(
                stats.stages.find((s) => s.stage === stageId)?.totalValue || 0
              )}
            </p>
          ) : null
        }
        renderCard={(deal) => (
          <Link href={path(`/dashboard/deals/${deal.id}`)} className="block p-3 space-y-2">
            <p className="text-sm font-semibold">{deal.title}</p>
            <p className="text-base font-bold text-emerald-600">
              {formatCurrency(deal.value, deal.currency as never)}
            </p>
            <div className="text-sm">
              <p className="font-medium">{deal.lead?.companyName}</p>
              {deal.lead?.contactName && (
                <p className="text-muted-foreground text-xs">{deal.lead.contactName}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-muted rounded h-1.5 overflow-hidden">
                <div
                  className="bg-primary h-full"
                  style={{ width: `${deal.probability}%` }}
                />
              </div>
              <span className="text-xs font-medium">{deal.probability}%</span>
            </div>
          </Link>
        )}
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New deal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>Lead *</Label>
              <Select
                value={form.leadId}
                onValueChange={(leadId) => {
                  const lead = leads.find((l) => l.id === leadId);
                  setForm((f) => ({
                    ...f,
                    leadId,
                    title: f.title || (lead ? `${lead.companyName} deal` : ''),
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a lead" />
                </SelectTrigger>
                <SelectContent>
                  {leads.map((lead) => (
                    <SelectItem key={lead.id} value={lead.id}>
                      {lead.companyName}
                      {lead.contactName ? ` — ${lead.contactName}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Title *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Enterprise package"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Value *</Label>
                <Input
                  type="number"
                  value={form.value}
                  onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Probability %</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={form.probability}
                  onChange={(e) => setForm((f) => ({ ...f, probability: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Stage</Label>
              <Select
                value={form.stage}
                onValueChange={(stage) => setForm((f) => ({ ...f, stage }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PROSPECTING">Prospecting</SelectItem>
                  <SelectItem value="QUALIFICATION">Qualification</SelectItem>
                  <SelectItem value="PROPOSAL">Proposal</SelectItem>
                  <SelectItem value="NEGOTIATION">Negotiation</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void createDeal()} disabled={creating}>
              {creating ? 'Creating…' : 'Create deal'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardPage>
  );
}
