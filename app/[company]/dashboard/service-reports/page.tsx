'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/ui/empty-state';
import { Loader2, FileCheck } from 'lucide-react';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';

type ServiceReportRow = {
  id: string;
  serviceNotes: string;
  partsReplaced: string | null;
  nextMaintenanceDate: string | null;
  createdAt: string;
  technician: { id: string; name: string | null; email: string | null };
  ticket: {
    id: string;
    subject: string;
    status: string;
    customer: { id: string; organizationName: string };
  };
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function statusVariant(
  status: string
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'RESOLVED':
    case 'CLOSED':
      return 'default';
    case 'IN_PROGRESS':
      return 'secondary';
    case 'OPEN':
      return 'outline';
    default:
      return 'secondary';
  }
}

export default function ServiceReportsPage() {
  const { slug, path, workspaceFetch } = useWorkspacePaths();

  const { data, isLoading } = useQuery({
    queryKey: ['service-reports', slug],
    queryFn: async () => {
      const res = await workspaceFetch('/api/service-reports');
      if (!res.ok) throw new Error('Failed to load service reports');
      return res.json() as Promise<{ reports: ServiceReportRow[] }>;
    },
    enabled: !!slug,
  });

  const reports = data?.reports ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b pb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Service reports</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Field visit notes and maintenance follow-ups from technicians.
          </p>
        </div>
      </div>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Reports</CardTitle>
          <CardDescription>
            Newest first — open the linked ticket for full history.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !reports.length ? (
            <EmptyState
              icon={FileCheck}
              title="No service reports yet"
              description="Reports appear here when technicians complete field visits."
              className="py-10"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Ticket</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Technician</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Next maintenance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {formatDate(r.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={path(`/dashboard/tickets/${r.ticket.id}`)}
                        className="font-medium hover:underline"
                      >
                        {r.ticket.subject}
                      </Link>
                      <div className="text-xs text-muted-foreground line-clamp-1 max-w-xs">
                        {r.serviceNotes}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={path(`/dashboard/customers/${r.ticket.customer.id}`)}
                        className="hover:underline"
                      >
                        {r.ticket.customer.organizationName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.technician.name || r.technician.email || '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(r.ticket.status)}>
                        {r.ticket.status.replaceAll('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {r.nextMaintenanceDate
                        ? formatDate(r.nextMaintenanceDate)
                        : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
