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
import { TableSkeleton } from '@/components/loading';
import Link from 'next/link';

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

  const { data, isLoading } = useQuery({
    queryKey: ['service-stats'],
    queryFn: async () => {
      const res = await workspaceFetch('/api/dashboard/service-stats?days=30');
      if (!res.ok) throw new Error('Failed to load stats');
      return (await res.json()) as ServiceStats;
    },
  });

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Service analytics</h1>
        <p className="text-sm text-muted-foreground">
          MTTR, technician load, and AMC renewals for the last {data?.periodDays ?? 30} days.
        </p>
      </div>

      {isLoading || !data ? (
        <TableSkeleton columnCount={4} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Tickets</CardDescription>
                <CardTitle className="text-3xl">{data.totals.tickets}</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                {data.totals.open} open · {data.totals.resolved} resolved
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Avg MTTR (hours)</CardDescription>
                <CardTitle className="text-3xl">
                  {data.mttrHours ?? '—'}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Avg first response (hours)</CardDescription>
                <CardTitle className="text-3xl">
                  {data.firstResponseHours ?? '—'}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Service reports</CardDescription>
                <CardTitle className="text-3xl">{data.totals.reports}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Technician utilization</CardTitle>
              <CardDescription>Open load, resolved tickets, and reports filed.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Technician</TableHead>
                    <TableHead>Open</TableHead>
                    <TableHead>Resolved</TableHead>
                    <TableHead>Reports</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.technicians.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>{t.name}</TableCell>
                      <TableCell>{t.open}</TableCell>
                      <TableCell>{t.resolved}</TableCell>
                      <TableCell>{t.reports}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
                        <TableCell>{c.title || c.id}</TableCell>
                        <TableCell>{c.customer?.organizationName || '—'}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{c.type || 'AMC'}</Badge>
                        </TableCell>
                        <TableCell>
                          {c.endDate
                            ? new Date(c.endDate).toLocaleDateString()
                            : '—'}
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
