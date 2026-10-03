'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useCurrency } from '@/hooks/use-currency';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { CardListSkeleton, StatCardsSkeleton } from '@/components/loading';
import { humanizeEnum } from '@/lib/humanize-enum';
import { toast } from 'sonner';
import { useSession } from 'next-auth/react';

export default function CashOnHandPage() {
  const [featureEnabled, setFeatureEnabled] = useState(true);
  const [entries, setEntries] = useState<any[]>([]);
  const [balances, setBalances] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { data: session } = useSession();
  const { formatCurrency } = useCurrency();
  const myId = session?.user?.id ?? '';
  // Technicians only log their own spending; managers record advances and settlements.
  const isManager = ['ADMIN', 'SUPER_ADMIN', 'SUPPORT_MANAGER'].includes(session?.user?.role ?? '');

  const [form, setForm] = useState({
    technicianId: '',
    ticketId: '',
    entryType: 'ADVANCE',
    amount: '',
    description: '',
    referenceNo: '',
  });

  const loadData = async () => {
    // Initial state is loading; refreshes after a save keep the page visible.
    try {
      const featureRes = await fetch('/api/features/me');
      if (featureRes.ok) {
        const featureData = await featureRes.json();
        if (featureData?.modules?.SERVICE_CASH !== true) {
          setFeatureEnabled(false);
          setLoading(false);
          return;
        }
      }

      const [entriesRes, balancesRes, techRes, ticketsRes] = await Promise.all([
        fetch('/api/service/cash'),
        fetch('/api/service/cash/stats'),
        fetch('/api/users/technicians'),
        fetch('/api/tickets'),
      ]);

      const entriesData = entriesRes.ok ? await entriesRes.json() : [];
      const balancesData = balancesRes.ok ? await balancesRes.json() : { balances: [] };
      const techData = techRes.ok ? await techRes.json() : [];
      const ticketsData = ticketsRes.ok ? await ticketsRes.json() : [];

      setEntries(entriesData);
      setBalances(balancesData.balances || []);
      setTechnicians(techData);
      setTickets(ticketsData);
    } catch (error) {
      toast.error('Failed to load cash data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const submitEntry = async () => {
    const technicianId = isManager ? form.technicianId : myId;
    const entryType = isManager ? form.entryType : 'EXPENSE';
    if (!technicianId || !form.amount || !form.description) {
      toast.error('Technician, amount, and description are required');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/service/cash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          technicianId,
          ticketId: form.ticketId && form.ticketId !== '__NONE__' ? form.ticketId : undefined,
          entryType,
          amount: Number(form.amount),
          description: form.description,
          referenceNo: form.referenceNo || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(typeof err.error === 'string' ? err.error : 'Failed to create cash entry');
      }
      toast.success('Cash entry recorded');
      setForm({
        technicianId: '',
        ticketId: '',
        entryType: 'ADVANCE',
        amount: '',
        description: '',
        referenceNo: '',
      });
      loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create cash entry');
    } finally {
      setSaving(false);
    }
  };

  const header = (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Cash on hand</h1>
      <p className="text-sm text-muted-foreground">Track technician advances, spending, and settlements.</p>
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        {header}
        <StatCardsSkeleton count={3} />
        <CardListSkeleton rows={4} />
      </div>
    );
  }

  if (!featureEnabled) {
    return (
      <div className="space-y-6">
        {header}
        <Card>
          <CardHeader><CardTitle>Cash on hand isn&apos;t enabled</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            This module is turned off for your workspace. Ask your administrator to enable it.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
        {balances.length === 0 ? (
          <Card className="col-span-2 md:col-span-3">
            <CardContent className="py-6 text-sm text-muted-foreground">No technician balances yet.</CardContent>
          </Card>
        ) : (
          balances.map((item: any) => (
            <Card key={item.technician.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base truncate">{item.technician.name || item.technician.email}</CardTitle>
                <CardDescription>Available cash balance</CardDescription>
              </CardHeader>
              <CardContent>
                <p className={`text-xl sm:text-2xl font-bold tabular-nums break-words ${item.balance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
                  {formatCurrency(item.balance)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Advance: {formatCurrency(item.totalAdvance)} • Spent: {formatCurrency(item.totalSpent)}
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Record a cash entry</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="cash-tech">Technician</Label>
              <Select
                value={isManager ? form.technicianId : myId}
                disabled={!isManager}
                onValueChange={(value) => setForm({ ...form, technicianId: value })}
              >
                <SelectTrigger id="cash-tech"><SelectValue placeholder="Select technician" /></SelectTrigger>
                <SelectContent>
                  {technicians.map((tech) => (
                    <SelectItem key={tech.id} value={tech.id}>{tech.name || tech.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cash-type">Entry type</Label>
              <Select
                value={isManager ? form.entryType : 'EXPENSE'}
                disabled={!isManager}
                onValueChange={(value) => setForm({ ...form, entryType: value })}
              >
                <SelectTrigger id="cash-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADVANCE">Advance</SelectItem>
                  <SelectItem value="EXPENSE">Expense</SelectItem>
                  <SelectItem value="SETTLEMENT">Settlement</SelectItem>
                  <SelectItem value="ADJUSTMENT">Adjustment</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cash-amount">Amount</Label>
              <Input
                id="cash-amount"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cash-ticket">Linked ticket (optional)</Label>
              <Select value={form.ticketId} onValueChange={(value) => setForm({ ...form, ticketId: value })}>
                <SelectTrigger id="cash-ticket"><SelectValue placeholder="Select ticket" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__NONE__">None</SelectItem>
                  {tickets.map((ticket) => (
                    <SelectItem key={ticket.id} value={ticket.id}>{ticket.subject}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cash-ref">Reference no. (optional)</Label>
              <Input
                value={form.referenceNo}
                onChange={(e) => setForm({ ...form, referenceNo: e.target.value })}
                id="cash-ref"
                placeholder="Voucher or cash slip number"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cash-desc">Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Reason for this cash movement"
            />
          </div>

          <Button className="w-full sm:w-auto" onClick={submitEntry} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {saving ? 'Saving…' : 'Record entry'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ledger</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-none border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Technician</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Ticket</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No cash entries yet.</TableCell>
                  </TableRow>
                ) : (
                  entries.map((entry: any) => (
                    <TableRow key={entry.id}>
                      <TableCell className="whitespace-nowrap">{format(new Date(entry.recordedAt), 'd MMM yyyy, HH:mm')}</TableCell>
                      <TableCell>{entry.technician?.name || entry.technician?.email}</TableCell>
                      <TableCell><Badge variant="outline">{humanizeEnum(entry.entryType)}</Badge></TableCell>
                      <TableCell>{entry.ticket?.subject || '—'}</TableCell>
                      <TableCell className={`whitespace-nowrap text-right font-medium tabular-nums ${entry.entryType === 'ADVANCE' || entry.entryType === 'ADJUSTMENT' ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
                        {formatCurrency(entry.amount, entry.currency)}
                      </TableCell>
                      <TableCell>{entry.description}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

