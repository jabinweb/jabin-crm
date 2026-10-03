'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { StatCardsSkeleton, TableSkeleton } from '@/components/loading';
import { EmptyState } from '@/components/ui/empty-state';
import { AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';

function formatHours(value: number | null) {
  if (value == null) return '—';
  return `${Math.round(value * 10) / 10}h`;
}

type ServiceStats = {
  periodDays: number;
  totals: { tickets: number; open: number; resolved: number; reports: number };
  mttrHours: number | null;
  firstResponseHours: number | null;
  technicians: Array<{
    id: string;
    name: string;
    open: number;
    resolved: number;
    reports: number;
  }>;
  renewalsDue: Array<{
    id: string;
    title?: string;
    type?: string;
    endDate?: string;
    customer?: { organizationName?: string };
  }>;
};

export default function ServiceAnalyticsPage() {
  const { path, workspaceFetch } = useWorkspacePaths();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['service-stats'],
    queryFn: async () => {
      const res = await workspaceFetch('/api/dashboard/service-stats?days=30');
      if (!res.ok) throw new Error('Failed to load stats');
      return (await res.json()) as ServiceStats;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Service analytics</h1>
        <p className="text-sm text-muted-foreground">
          Resolution times, technician workload, and upcoming AMC/CMC renewals over the last{' '}
          {data?.periodDays ?? 30} days.
        </p>
      </div>

      {isError ? (
        <Card>
          <EmptyState
            icon={AlertTriangle}
            title="Couldn't load service analytics"
            description="Something went wrong while loading the numbers. Try again in a moment."
            actionLabel="Try again"
            onAction={() => refetch()}
          />
        </Card>
      ) : isLoading || !data ? (
        <div className="space-y-6">
          <StatCardsSkeleton count={4} />
          <TableSkeleton columnCount={4} />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Tickets</CardDescription>
                <CardTitle className="text-2xl sm:text-3xl tabular-nums">{data.totals.tickets}</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                {data.totals.open} open · {data.totals.resolved} resolved
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Avg time to resolve</CardDescription>
                <CardTitle className="text-2xl sm:text-3xl tabular-nums">
                  {formatHours(data.mttrHours)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Avg first response</CardDescription>
                <CardTitle className="text-2xl sm:text-3xl tabular-nums">
                  {formatHours(data.firstResponseHours)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Service reports</CardDescription>
                <CardTitle className="text-2xl sm:text-3xl tabular-nums">{data.totals.reports}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Technician utilization</CardTitle>
              <CardDescription>Open load, resolved tickets, and reports filed.</CardDescription>
            </CardHeader>
            <CardContent>
              {data.technicians.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No technician activity in this period.
                </p>
              ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Technician</TableHead>
                    <TableHead className="text-right">Open</TableHead>
                    <TableHead className="text-right">Resolved</TableHead>
                    <TableHead className="text-right">Reports</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.technicians.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{t.open}</TableCell>
                      <TableCell className="text-right tabular-nums">{t.resolved}</TableCell>
                      <TableCell className="text-right tabular-nums">{t.reports}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">AMC / CMC renewals due</CardTitle>
              <CardDescription>
                From contract renewal alerts.{' '}
                <Link href={path('/dashboard/contracts')} className="text-primary underline">
                  Open contracts
                </Link>
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(data.renewalsDue || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No renewals in the alert window.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contract</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Ends</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.renewalsDue.slice(0, 20).map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.title || 'Untitled contract'}</TableCell>
                        <TableCell>{c.customer?.organizationName || '—'}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{c.type || 'AMC'}</Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {c.endDate ? format(new Date(c.endDate), 'd MMM yyyy') : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
