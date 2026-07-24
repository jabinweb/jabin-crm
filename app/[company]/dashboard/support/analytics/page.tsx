'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Ticket,
  Clock,
  Star,
  TrendingUp,
  BarChart3,
} from 'lucide-react';
import { FeatureModuleGuard } from '@/components/feature-module-guard';
import { SupportBackLink } from '@/components/support/support-back-link';
import { StatCardsSkeleton, SectionSkeleton } from '@/components/loading';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';

export default function SupportAnalyticsPage() {
  const { slug, workspaceFetch } = useWorkspacePaths();

  const { data, isLoading } = useQuery({
    queryKey: ['support-stats', slug],
    queryFn: async () => {
      const res = await workspaceFetch('/api/dashboard/support-stats?days=30');
      if (!res.ok) throw new Error('Failed to load stats');
      return res.json();
    },
  });

  return (
    <FeatureModuleGuard module="TICKETS">
      <div className="space-y-8">
        <div>
          <SupportBackLink />
          <h1 className="text-3xl font-bold tracking-tight">Support analytics</h1>
          <p className="text-muted-foreground mt-1">
            Executive view — volume, SLA compliance, CSAT, and channel mix (last 30 days).
          </p>
        </div>

        {isLoading ? (
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
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <Ticket className="h-4 w-4" /> Total tickets
                  </CardDescription>
                  <CardTitle className="text-3xl">{data.summary.totalTickets}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">{data.summary.openTickets} open</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" /> Resolution rate
                  </CardDescription>
                  <CardTitle className="text-3xl">{data.summary.resolutionRate}%</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">{data.summary.resolvedTickets} resolved/closed</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <Clock className="h-4 w-4" /> SLA compliance
                  </CardDescription>
                  <CardTitle className="text-3xl">{data.sla.complianceRate}%</CardTitle>
                </CardHeader>
                <CardContent className="flex gap-2 text-xs">
                  <Badge variant="outline">{data.sla.atRisk} at risk</Badge>
                  <Badge variant="destructive">{data.sla.breached} breached</Badge>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <Star className="h-4 w-4" /> Avg CSAT
                  </CardDescription>
                  <CardTitle className="text-3xl">
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
                        <span className="text-xs text-muted-foreground w-24">{row.date}</span>
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
                  {data.byChannel.map((c: { channel: string; count: number }) => (
                    <div key={c.channel} className="flex justify-between items-center">
                      <Badge variant="secondary">{c.channel}</Badge>
                      <span className="font-medium">{c.count}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">By priority</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.byPriority.map((p: { priority: string; count: number }) => (
                    <div key={p.priority} className="flex justify-between items-center">
                      <span>{p.priority}</span>
                      <span className="font-medium">{p.count}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">By status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.byStatus.map((s: { status: string; count: number }) => (
                    <div key={s.status} className="flex justify-between items-center">
                      <span>{s.status}</span>
                      <span className="font-medium">{s.count}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </FeatureModuleGuard>
  );
}
