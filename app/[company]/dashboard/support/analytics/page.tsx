'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Ticket,
  Clock,
  Star,
  TrendingUp,
  BarChart3,
  AlertTriangle,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { humanizeEnum, ENUM_LABEL_OVERRIDES } from '@/lib/humanize-enum';
import { FeatureModuleGuard } from '@/components/feature-module-guard';
import { SupportBackLink } from '@/components/support/support-back-link';
import { StatCardsSkeleton, SectionSkeleton } from '@/components/loading';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';

export default function SupportAnalyticsPage() {
  const { slug, workspaceFetch } = useWorkspacePaths();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['support-stats', slug],
    queryFn: async () => {
      const res = await workspaceFetch('/api/dashboard/support-stats?days=30');
      if (!res.ok) throw new Error('Failed to load stats');
      return res.json();
    },
  });

  return (
    <FeatureModuleGuard module="TICKETS">
      <div className="space-y-6">
        <div>
          <SupportBackLink />
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Support analytics</h1>
          <p className="text-muted-foreground mt-1">
            Ticket volume, SLA compliance, CSAT, and channel mix over the last 30 days.
          </p>
        </div>

        {isError || (!isLoading && !data?.summary) ? (
          <Card>
            <EmptyState
              icon={AlertTriangle}
              title="Couldn't load support analytics"
              description="Something went wrong while loading the numbers. Try again in a moment."
              actionLabel="Try again"
              onAction={() => refetch()}
            />
          </Card>
        ) : isLoading ? (
          <div className="space-y-6">
            <StatCardsSkeleton />
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardContent className="pt-6">
                  <SectionSkeleton lines={5} />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <SectionSkeleton lines={4} />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <SectionSkeleton lines={4} />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <SectionSkeleton lines={4} />
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex min-w-0 items-center gap-2">
                    <Ticket className="h-4 w-4" /> Total tickets
                  </CardDescription>
                  <CardTitle className="text-2xl sm:text-3xl tabular-nums">{data.summary.totalTickets}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">{data.summary.openTickets} open</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex min-w-0 items-center gap-2">
                    <TrendingUp className="h-4 w-4" /> Resolution rate
                  </CardDescription>
                  <CardTitle className="text-2xl sm:text-3xl tabular-nums">{data.summary.resolutionRate}%</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">{data.summary.resolvedTickets} resolved/closed</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex min-w-0 items-center gap-2">
                    <Clock className="h-4 w-4" /> SLA compliance
                  </CardDescription>
                  <CardTitle className="text-2xl sm:text-3xl tabular-nums">{data.sla.complianceRate}%</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="outline">{data.sla.atRisk} at risk</Badge>
                  <Badge variant="destructive">{data.sla.breached} breached</Badge>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex min-w-0 items-center gap-2">
                    <Star className="h-4 w-4" /> Avg CSAT
                  </CardDescription>
                  <CardTitle className="text-2xl sm:text-3xl tabular-nums">
                    {data.summary.avgCsat ?? '—'}
                    {data.summary.avgCsat ? <span className="text-lg text-muted-foreground">/5</span> : null}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">{data.summary.csatResponses} responses</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <BarChart3 className="h-5 w-5" /> Volume trend
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 max-h-64 overflow-y-auto">
                  {data.volumeTrend.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No tickets in this period.</p>
                  ) : (
                    data.volumeTrend.map((row: { date: string; count: number }) => (
                      <div key={row.date} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-16 shrink-0 tabular-nums">
                          {format(parseISO(row.date), 'd MMM')}
                        </span>
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{
                              width: `${Math.min(100, (row.count / Math.max(...data.volumeTrend.map((r: { count: number }) => r.count), 1)) * 100)}%`,
                            }}
                          />
                        </div>
                        <span className="text-sm font-medium w-8 text-right">{row.count}</span>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Channel mix</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.byChannel.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No tickets in this period.</p>
                  ) : (
                    data.byChannel.map((c: { channel: string; count: number }) => (
                      <div key={c.channel} className="flex justify-between items-center">
                        <Badge variant="secondary">{humanizeEnum(c.channel, ENUM_LABEL_OVERRIDES)}</Badge>
                        <span className="font-medium tabular-nums">{c.count}</span>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">By priority</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.byPriority.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No tickets in this period.</p>
                  ) : (
                    data.byPriority.map((p: { priority: string; count: number }) => (
                      <div key={p.priority} className="flex justify-between items-center">
                        <span>{humanizeEnum(p.priority)}</span>
                        <span className="font-medium tabular-nums">{p.count}</span>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">By status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.byStatus.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No tickets in this period.</p>
                  ) : (
                    data.byStatus.map((s: { status: string; count: number }) => (
                      <div key={s.status} className="flex justify-between items-center">
                        <span>{humanizeEnum(s.status)}</span>
                        <span className="font-medium tabular-nums">{s.count}</span>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </FeatureModuleGuard>
  );
}
