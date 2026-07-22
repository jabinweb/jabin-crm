'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { TicketSlaTimer } from '@/components/tickets/ticket-sla-timer';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Ticket, Plus, Search, UserCheck, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';

export default function TicketsPage() {
  const router = useRouter();
  const { slug, path, workspaceFetch } = useWorkspacePaths();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [priority, setPriority] = useState<string>('all');

  const { data: tickets, isLoading } = useQuery({
    queryKey: ['tickets', slug, { status, priority }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status !== 'all') params.append('status', status);
      if (priority !== 'all') params.append('priority', priority);

      const response = await workspaceFetch(`/api/tickets?${params}`);
      if (!response.ok) throw new Error('Failed to fetch tickets');
      return response.json();
    },
  });

  const filteredTickets = tickets?.filter(
    (t: { subject: string; customer?: { organizationName?: string } }) =>
      t.subject.toLowerCase().includes(search.toLowerCase()) ||
      (t.customer?.organizationName ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const getPriorityVariant = (p: string) => {
    switch (p) {
      case 'CRITICAL':
        return 'destructive';
      case 'HIGH':
        return 'default';
      case 'MEDIUM':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const formatStatus = (s: string) => s.replaceAll('_', ' ').toLowerCase();

  return (
    <div className="flex-1 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between border-b pb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tickets</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Assign work, track SLA, and close service requests.
          </p>
        </div>
        <Button asChild>
          <Link href={path('/dashboard/tickets/new')}>
            <Plus className="mr-2 h-4 w-4" />
            New ticket
          </Link>
        </Button>
      </div>

      <Card className="shadow-none">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base font-semibold">Queue</CardTitle>
              <CardDescription>Search by subject or client name</CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tickets…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="OPEN">Open</SelectItem>
                  <SelectItem value="ASSIGNED">Assigned</SelectItem>
                  <SelectItem value="IN_PROGRESS">In progress</SelectItem>
                  <SelectItem value="RESOLVED">Resolved</SelectItem>
                </SelectContent>
              </Select>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All priority</SelectItem>
                  <SelectItem value="CRITICAL">Critical</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="LOW">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : !filteredTickets?.length ? (
            <EmptyState
              icon={Ticket}
              title={search || status !== 'all' || priority !== 'all' ? 'No matching tickets' : 'No tickets yet'}
              description={
                search || status !== 'all' || priority !== 'all'
                  ? 'Try clearing filters or searching a different client.'
                  : 'Create a ticket when a client needs service.'
              }
              actionLabel={search || status !== 'all' || priority !== 'all' ? undefined : 'New ticket'}
              actionHref={
                search || status !== 'all' || priority !== 'all'
                  ? undefined
                  : path('/dashboard/tickets/new')
              }
            />
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">ID</TableHead>
                    <TableHead>Subject / client</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Assigned</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>SLA</TableHead>
                    <TableHead className="text-right"> </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTickets.map(
                    (ticket: {
                      id: string;
                      subject: string;
                      priority: string;
                      status: string;
                      createdAt: string;
                      responseDueAt?: string | null;
                      resolutionDueAt?: string | null;
                      firstResponseAt?: string | null;
                      customer?: { organizationName?: string };
                      assignedTechnician?: { name?: string } | null;
                    }) => (
                      <TableRow
                        key={ticket.id}
                        className="hover:bg-muted/40 cursor-pointer"
                        onClick={() => router.push(path(`/dashboard/tickets/${ticket.id}`))}
                      >
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {ticket.id.slice(-6).toUpperCase()}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-0.5">
                            <p className="font-medium text-sm">{ticket.subject}</p>
                            <p className="text-xs text-muted-foreground">
                              {ticket.customer?.organizationName ?? '—'}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getPriorityVariant(ticket.priority)} className="text-[10px]">
                            {ticket.priority}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-xs">
                            <UserCheck className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{ticket.assignedTechnician?.name || 'Unassigned'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={cn('text-xs capitalize')}>{formatStatus(ticket.status)}</span>
                        </TableCell>
                        <TableCell>
                          <TicketSlaTimer ticket={ticket} />
                        </TableCell>
                        <TableCell className="text-right">
                          <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground" />
                        </TableCell>
                      </TableRow>
                    )
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
