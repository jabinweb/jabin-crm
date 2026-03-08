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
import { formatCurrency } from '@/lib/currency';
import { toast } from 'sonner';

export default function CashOnHandPage() {
  const [featureEnabled, setFeatureEnabled] = useState(true);
  const [entries, setEntries] = useState<any[]>([]);
  const [balances, setBalances] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    technicianId: '',
    ticketId: '',
    entryType: 'ADVANCE',
    amount: '',
    description: '',
    referenceNo: '',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const featureRes = await fetch('/api/features/me');
      if (featureRes.ok) {
        const featureData = await featureRes.json();
        if (featureData?.modules?.SERVICE_CASH === false) {
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
    if (!form.technicianId || !form.amount || !form.description) {
      toast.error('Technician, amount, and description are required');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/service/cash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          technicianId: form.technicianId,
          ticketId: form.ticketId && form.ticketId !== '__NONE__' ? form.ticketId : undefined,
          entryType: form.entryType,
          amount: Number(form.amount),
          description: form.description,
          referenceNo: form.referenceNo || undefined,
        }),
      });

      if (!res.ok) throw new Error('Failed to create entry');
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
      toast.error('Failed to create cash entry');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="container mx-auto p-4 md:p-6 lg:p-8">Loading cash dashboard...</div>;
  }

  if (!featureEnabled) {
    return (
      <div className="container mx-auto p-4 md:p-6 lg:p-8">
        <Card>
          <CardHeader><CardTitle>Module Disabled</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Cash On Hand is disabled by your Super Admin.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Cash On Hand</h1>
        <p className="text-sm text-muted-foreground">Track technician advances, spends, and settlements.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {balances.length === 0 ? (
          <Card className="md:col-span-3">
            <CardContent className="py-6 text-sm text-muted-foreground">No technician balances yet.</CardContent>
          </Card>
        ) : (
          balances.map((item: any) => (
            <Card key={item.technician.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{item.technician.name || item.technician.email}</CardTitle>
                <CardDescription>Available cash balance</CardDescription>
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${item.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(item.balance, 'USD')}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Advance: {formatCurrency(item.totalAdvance, 'USD')} • Spent: {formatCurrency(item.totalSpent, 'USD')}
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add Cash Entry</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label>Technician</Label>
              <Select value={form.technicianId} onValueChange={(value) => setForm({ ...form, technicianId: value })}>
                <SelectTrigger><SelectValue placeholder="Select technician" /></SelectTrigger>
                <SelectContent>
                  {technicians.map((tech) => (
                    <SelectItem key={tech.id} value={tech.id}>{tech.name || tech.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Entry Type</Label>
              <Select value={form.entryType} onValueChange={(value) => setForm({ ...form, entryType: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADVANCE">Advance</SelectItem>
                  <SelectItem value="EXPENSE">Expense</SelectItem>
                  <SelectItem value="SETTLEMENT">Settlement</SelectItem>
                  <SelectItem value="ADJUSTMENT">Adjustment</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Linked Ticket (Optional)</Label>
              <Select value={form.ticketId} onValueChange={(value) => setForm({ ...form, ticketId: value })}>
                <SelectTrigger><SelectValue placeholder="Select ticket" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__NONE__">None</SelectItem>
                  {tickets.map((ticket) => (
                    <SelectItem key={ticket.id} value={ticket.id}>{ticket.subject}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reference No (Optional)</Label>
              <Input
                value={form.referenceNo}
                onChange={(e) => setForm({ ...form, referenceNo: e.target.value })}
                placeholder="Voucher / Cash Slip"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Reason for this cash movement"
            />
          </div>

          <Button onClick={submitEntry} disabled={saving}>
            {saving ? 'Saving...' : 'Record Entry'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Entry Ledger</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Technician</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Ticket</TableHead>
                  <TableHead>Amount</TableHead>
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
                      <TableCell>{new Date(entry.recordedAt).toLocaleString()}</TableCell>
                      <TableCell>{entry.technician?.name || entry.technician?.email}</TableCell>
                      <TableCell><Badge variant="outline">{entry.entryType}</Badge></TableCell>
                      <TableCell>{entry.ticket?.subject || '-'}</TableCell>
                      <TableCell className={entry.entryType === 'ADVANCE' || entry.entryType === 'ADJUSTMENT' ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
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
