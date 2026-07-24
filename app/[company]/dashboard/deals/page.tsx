'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, DollarSign, TrendingUp, Award } from 'lucide-react';
import { useCurrency } from '@/hooks/use-currency';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { usePipelineColumns } from '@/hooks/use-pipeline-columns';
import { PipelineBoard, buildBoardState } from '@/components/pipelines/pipeline-board';
import { toast } from 'sonner';
import { DashboardPage } from '@/components/layout/dashboard-page';
import { BoardSkeleton, PageHeaderSkeleton, StatCardsSkeleton } from '@/components/loading';

type Deal = {
  id: string;
  title: string;
  value: number;
  currency: string;
  stage: string;
  probability: number;
  lead: {
    companyName: string;
    contactName?: string;
  };
};

type PipelineStats = {
  stages: Array<{ stage: string; count: number; totalValue: number }>;
  totalValue: number;
  weightedValue: number;
};

export default function DealsPage() {
  const { workspaceFetch } = useWorkspacePaths();
  const { columns: baseColumns, loading: columnsLoading } = usePipelineColumns('deals');
  const [deals, setDeals] = useState<Deal[]>([]);
  const [stats, setStats] = useState<PipelineStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { formatCurrency } = useCurrency();

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
          <h1 className="text-2xl font-semibold tracking-tight">Deal pipeline</h1>
          <p className="text-sm text-muted-foreground">
            Track deals through your sales process
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New deal
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
          <div className="p-3 space-y-2">
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
          </div>
        )}
      />
    </DashboardPage>
  );
}
