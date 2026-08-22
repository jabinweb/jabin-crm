'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Ticket, Plus, Search, UserCheck, ChevronRight, LayoutGrid, List, Bookmark, X, Mail, MessageCircle, Phone } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { PipelineBoard, buildBoardState } from '@/components/pipelines/pipeline-board';
import { usePipelineColumns } from '@/hooks/use-pipeline-columns';
import { BoardSkeleton, FullTableSkeleton } from '@/components/loading';
import { toast } from 'sonner';
import { useRealtime } from '@/hooks/use-realtime';
import { REALTIME_EVENTS } from '@/lib/realtime/events';

type TicketRow = {
  id: string;
  subject: string;
  priority: string;
  status: string;
  createdAt: string;
  stage?: string;
  channel?: string;
  responseDueAt?: string | null;
  resolutionDueAt?: string | null;
  firstResponseAt?: string | null;
  customer?: { organizationName?: string };
  assignedTechnician?: { name?: string } | null;
};

type SavedFilter = {
  id: string;
  name: string;
  filters: { status?: string; priority?: string; search?: string };
};

export default function TicketsPage() {
  const router = useRouter();
  const { slug, path, workspaceFetch } = useWorkspacePaths();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [priority, setPriority] = useState<string>('all');
  const [view, setView] = useState<'list' | 'board'>('list');
  const [optimistic, setOptimistic] = useState<Record<string, string>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [tagValue, setTagValue] = useState('');
  const [saveFilterOpen, setSaveFilterOpen] = useState(false);
  const [filterName, setFilterName] = useState('');
  const { columns: baseColumns, loading: columnsLoading } = usePipelineColumns('tickets');

  const { data: tickets, isLoading } = useQuery({
    queryKey: ['tickets', slug, { status, priority }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status !== 'all') params.append('status', status);
      if (priority !== 'all') params.append('priority', priority);

      const response = await workspaceFetch(`/api/tickets?${params}`);
      if (!response.ok) throw new Error('Failed to fetch tickets');
      return response.json() as Promise<TicketRow[]>;
    },
  });

  const { data: savedFilters = [] } = useQuery({
    queryKey: ['ticket-saved-filters', slug],
    queryFn: async () => {
      const res = await workspaceFetch('/api/tickets/saved-filters');
      if (!res.ok) return [] as SavedFilter[];
      return res.json() as Promise<SavedFilter[]>;
    },
  });

  useRealtime({
    types: [
      REALTIME_EVENTS.TICKET_UPDATED,
      REALTIME_EVENTS.TICKET_COMMENT,
      REALTIME_EVENTS.TICKET_MOVED,
      REALTIME_EVENTS.BOARD_MOVED,
    ],
    onEvent: (e) => {
      if (
        e.type === REALTIME_EVENTS.BOARD_MOVED &&
        e.payload?.entity !== 'tickets'
      ) {
        return;
      }
      void queryClient.invalidateQueries({ queryKey: ['tickets', slug] });
    },
  });

  const filteredTickets = useMemo(() => {
    return (tickets ?? []).filter(
      (t) =>
        t.subject.toLowerCase().includes(search.toLowerCase()) ||
        (t.customer?.organizationName ?? '').toLowerCase().includes(search.toLowerCase())
    );
  }, [tickets, search]);

  const boardItems = useMemo(
    () =>
      filteredTickets.map((t) => {
        const stage = optimistic[t.id] ?? t.status;
        return { ...t, status: stage, stage };
      }),
    [filteredTickets, optimistic]
  );
  const { columns, itemsByStage } = useMemo(
    () => buildBoardState(boardItems, baseColumns),
    [boardItems, baseColumns]
  );

  const allVisibleSelected =
    filteredTickets.length > 0 && filteredTickets.every((t) => selectedIds.has(t.id));

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredTickets.map((t) => t.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const toggleSelect = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const runBulk = async (payload: Record<string, unknown>) => {
    const ticketIds = Array.from(selectedIds);
    if (!ticketIds.length) return;
    const snapshot = filteredTickets
      .filter((t) => ticketIds.includes(t.id))
      .map((t) => ({ id: t.id, status: t.status, priority: t.priority }));
    setBulkBusy(true);
    try {
      const res = await workspaceFetch('/api/tickets/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, ticketIds }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Bulk action failed');
      setSelectedIds(new Set());
      await queryClient.invalidateQueries({ queryKey: ['tickets', slug] });
      toast.success(`Updated ${body.updated ?? ticketIds.length} ticket(s)`, {
        action: {
          label: 'Undo',
          onClick: () => {
            void (async () => {
              if (payload.action === 'set_status') {
                for (const row of snapshot) {
                  await workspaceFetch(`/api/tickets/${row.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: row.status }),
                  });
                }
              } else if (payload.action === 'set_priority') {
                await workspaceFetch('/api/tickets/bulk', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    action: 'set_priority',
                    ticketIds: snapshot.map((s) => s.id),
                    // undo per-ticket via individual if mixed — best-effort first status
                    priority: snapshot[0]?.priority,
                  }),
                });
                for (const row of snapshot) {
                  await workspaceFetch('/api/tickets/bulk', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      action: 'set_priority',
                      ticketIds: [row.id],
                      priority: row.priority,
                    }),
                  });
                }
              }
              await queryClient.invalidateQueries({ queryKey: ['tickets', slug] });
              toast.success('Bulk action undone');
            })();
          },
        },
        duration: 8000,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Bulk action failed');
    } finally {
      setBulkBusy(false);
    }
  };

  const applySavedFilter = (filterId: string) => {
    const row = savedFilters.find((f) => f.id === filterId);
    if (!row) return;
    const f = row.filters || {};
    setStatus(f.status || 'all');
    setPriority(f.priority || 'all');
    setSearch(f.search || '');
    toast.success(`Applied “${row.name}”`);
  };

  const saveCurrentFilter = async () => {
    const name = filterName.trim();
    if (!name) {
      toast.error('Name required');
      return;
    }
    try {
      const res = await workspaceFetch('/api/tickets/saved-filters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          filters: { status, priority, search },
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save filter');
      }
      toast.success('Filter saved');
      setSaveFilterOpen(false);
      setFilterName('');
      await queryClient.invalidateQueries({ queryKey: ['ticket-saved-filters', slug] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save filter');
    }
  };

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

  const onMove = async (id: string, toStage: string, fromStage: string) => {
    if (toStage === fromStage) return;
    setOptimistic((prev) => ({ ...prev, [id]: toStage }));
    try {
      const res = await workspaceFetch(`/api/tickets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: toStage }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update ticket');
      }
      void workspaceFetch('/api/realtime/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity: 'tickets', id, from: fromStage, to: toStage }),
      });
      setOptimistic((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      await queryClient.invalidateQueries({ queryKey: ['tickets', slug] });
    } catch (error) {
      setOptimistic((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      toast.error(error instanceof Error ? error.message : 'Move failed');
      await queryClient.invalidateQueries({ queryKey: ['tickets', slug] });
    }
  };

  return (
    <div className="flex-1 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between border-b pb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tickets</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Assign work, track SLA, and close service requests.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={view === 'list' ? 'default' : 'outline'}
              onClick={() => setView('list')}
            >
              <List className="mr-1.5 h-4 w-4" />
              List
            </Button>
            <Button
              size="sm"
              variant={view === 'board' ? 'default' : 'outline'}
              onClick={() => setView('board')}
            >
              <LayoutGrid className="mr-1.5 h-4 w-4" />
              Board
            </Button>
          </div>
          <Button asChild>
            <Link href={path('/dashboard/tickets/new')}>
              <Plus className="mr-2 h-4 w-4" />
              New ticket
            </Link>
          </Button>
        </div>
      </div>

      <Card className="shadow-none">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base font-semibold">
                {view === 'board' ? 'Ticket pipeline' : 'Queue'}
              </CardTitle>
              <CardDescription>
                {view === 'board'
                  ? 'Drag tickets between stages'
                  : 'Search by subject or client name'}
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto flex-wrap">
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
              <Select
                onValueChange={(v) => {
                  if (v && v !== '_none') applySavedFilter(v);
                }}
              >
                <SelectTrigger className="w-full sm:w-[170px]">
                  <SelectValue placeholder="Saved filters" />
                </SelectTrigger>
                <SelectContent>
                  {savedFilters.length === 0 ? (
                    <SelectItem value="_none" disabled>
                      No saved filters
                    </SelectItem>
                  ) : (
                    savedFilters.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {savedFilters.length > 0 ? (
                <Select
                  value=""
                  onValueChange={async (filterId) => {
                    if (!filterId) return;
                    const res = await workspaceFetch(
                      `/api/tickets/saved-filters?id=${encodeURIComponent(filterId)}`,
                      { method: 'DELETE' }
                    );
                    if (!res.ok) {
                      toast.error('Could not delete filter');
                      return;
                    }
                    toast.success('Filter deleted');
                    await queryClient.invalidateQueries({
                      queryKey: ['ticket-saved-filters', slug],
                    });
                  }}
                >
                  <SelectTrigger className="w-full sm:w-[150px]">
                    <SelectValue placeholder="Delete filter" />
                  </SelectTrigger>
                  <SelectContent>
                    {savedFilters.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        Delete “{f.name}”
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10"
                onClick={() => setSaveFilterOpen(true)}
              >
                <Bookmark className="mr-1.5 h-3.5 w-3.5" />
                Save current filter
              </Button>
            </div>
          </div>
          {(status !== 'all' || priority !== 'all' || search) && (
            <div className="flex flex-wrap gap-2 mt-3">
              {status !== 'all' && (
                <Badge variant="secondary" className="gap-1 pr-1">
                  Status: {status}
                  <button
                    type="button"
                    className="rounded-sm p-0.5 hover:bg-muted"
                    onClick={() => setStatus('all')}
                    aria-label="Clear status"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {priority !== 'all' && (
                <Badge variant="secondary" className="gap-1 pr-1">
                  Priority: {priority}
                  <button
                    type="button"
                    className="rounded-sm p-0.5 hover:bg-muted"
                    onClick={() => setPriority('all')}
                    aria-label="Clear priority"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {search && (
                <Badge variant="secondary" className="gap-1 pr-1 max-w-[200px]">
                  <span className="truncate">Search: {search}</span>
                  <button
                    type="button"
                    className="rounded-sm p-0.5 hover:bg-muted"
                    onClick={() => setSearch('')}
                    aria-label="Clear search"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
            </div>
          )}
        </CardHeader>
        <CardContent>
          {view === 'list' && selectedIds.size > 0 ? (
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
              <span className="text-sm font-medium">{selectedIds.size} selected</span>
              <Select
                disabled={bulkBusy}
                onValueChange={(v) => runBulk({ action: 'set_status', status: v })}
              >
                <SelectTrigger className="h-8 w-[140px]">
                  <SelectValue placeholder="Set status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OPEN">Open</SelectItem>
                  <SelectItem value="ASSIGNED">Assigned</SelectItem>
                  <SelectItem value="IN_PROGRESS">In progress</SelectItem>
                  <SelectItem value="RESOLVED">Resolved</SelectItem>
                  <SelectItem value="CLOSED">Closed</SelectItem>
                </SelectContent>
              </Select>
              <Select
                disabled={bulkBusy}
                onValueChange={(v) => runBulk({ action: 'set_priority', priority: v })}
              >
                <SelectTrigger className="h-8 w-[140px]">
                  <SelectValue placeholder="Set priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CRITICAL">Critical</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="LOW">Low</SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                disabled={bulkBusy}
                onClick={() => {
                  setTagValue('');
                  setTagDialogOpen(true);
                }}
              >
                Add tag
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={bulkBusy}
                onClick={() => setSelectedIds(new Set())}
              >
                Clear
              </Button>
            </div>
          ) : null}

          {view === 'board' ? (
            isLoading || columnsLoading ? (
              <BoardSkeleton />
            ) : (
              <PipelineBoard
                columns={columns}
                itemsByStage={itemsByStage}
                onMove={onMove}
                renderCard={(ticket) => (
                  <button
                    type="button"
                    className="w-full text-left p-3 space-y-1"
                    onClick={() => router.push(path(`/dashboard/tickets/${ticket.id}`))}
                  >
                    <p className="text-sm font-semibold line-clamp-2">{ticket.subject}</p>
                    <p className="text-xs text-muted-foreground">
                      {ticket.customer?.organizationName || 'No customer'}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant={getPriorityVariant(ticket.priority)} className="text-[10px]">
                        {ticket.priority}
                      </Badge>
                      {ticket.assignedTechnician?.name && (
                        <Badge variant="outline" className="text-[10px]">
                          {ticket.assignedTechnician.name}
                        </Badge>
                      )}
                    </div>
                  </button>
                )}
              />
            )
          ) : isLoading ? (
            <FullTableSkeleton columnCount={8} rowCount={5} />
          ) : !filteredTickets?.length ? (
            <EmptyState
              icon={Ticket}
              title={
                search || status !== 'all' || priority !== 'all'
                  ? 'No matching tickets'
                  : 'No tickets yet'
              }
              description={
                search || status !== 'all' || priority !== 'all'
                  ? 'Try clearing filters or searching a different client.'
                  : 'Create a ticket when a client needs service.'
              }
              actionLabel={
                search || status !== 'all' || priority !== 'all' ? undefined : 'New ticket'
              }
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
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allVisibleSelected}
                        onCheckedChange={(c) => toggleSelectAll(c === true)}
                        aria-label="Select all"
                      />
                    </TableHead>
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
                  {filteredTickets.map((ticket) => (
                    <TableRow
                      key={ticket.id}
                      className="hover:bg-muted/40 cursor-pointer"
                      onClick={() => router.push(path(`/dashboard/tickets/${ticket.id}`))}
                    >
                      <TableCell
                        onClick={(e) => e.stopPropagation()}
                        className="w-10"
                      >
                        <Checkbox
                          checked={selectedIds.has(ticket.id)}
                          onCheckedChange={(c) => toggleSelect(ticket.id, c === true)}
                          aria-label={`Select ${ticket.subject}`}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {ticket.id.slice(-6).toUpperCase()}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          <p className="font-medium text-sm">{ticket.subject}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                            {ticket.channel === 'EMAIL' && <Mail className="h-3 w-3" />}
                            {ticket.channel === 'CHAT' && <MessageCircle className="h-3 w-3" />}
                            {ticket.channel === 'PHONE' && <Phone className="h-3 w-3" />}
                            {ticket.channel && (
                              <span className="uppercase text-[10px]">{ticket.channel}</span>
                            )}
                            <span>{ticket.customer?.organizationName ?? '—'}</span>
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
                        <span className={cn('text-xs capitalize')}>
                          {formatStatus(ticket.status)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <TicketSlaTimer ticket={ticket} />
                      </TableCell>
                      <TableCell className="text-right">
                        <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={tagDialogOpen} onOpenChange={setTagDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add tag</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Tag</Label>
            <Input
              value={tagValue}
              onChange={(e) => setTagValue(e.target.value)}
              placeholder="e.g. billing"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTagDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={bulkBusy || !tagValue.trim()}
              onClick={async () => {
                await runBulk({ action: 'add_tag', tag: tagValue.trim() });
                setTagDialogOpen(false);
              }}
            >
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={saveFilterOpen} onOpenChange={setSaveFilterOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save current filter</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Name</Label>
            <Input
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              placeholder="My open high-priority"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveFilterOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveCurrentFilter}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
