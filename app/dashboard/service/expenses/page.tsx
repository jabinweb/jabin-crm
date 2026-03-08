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

const statusColors: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  REIMBURSED: 'bg-blue-100 text-blue-700',
};

export default function ServiceExpensesPage() {
  const [featureEnabled, setFeatureEnabled] = useState(true);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    technicianId: '',
    ticketId: '',
    category: 'TRAVEL',
    amount: '',
    distanceKm: '',
    fromLocation: '',
    toLocation: '',
    description: '',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const featureRes = await fetch('/api/features/me');
      if (featureRes.ok) {
        const featureData = await featureRes.json();
        if (featureData?.modules?.SERVICE_EXPENSES === false) {
          setFeatureEnabled(false);
          setLoading(false);
          return;
        }
      }

      const [expensesRes, statsRes, techRes, ticketsRes] = await Promise.all([
        fetch('/api/service/expenses'),
        fetch('/api/service/expenses/stats'),
        fetch('/api/users/technicians'),
        fetch('/api/tickets'),
      ]);

      setExpenses(expensesRes.ok ? await expensesRes.json() : []);
      setStats(statsRes.ok ? await statsRes.json() : null);
      setTechnicians(techRes.ok ? await techRes.json() : []);
      setTickets(ticketsRes.ok ? await ticketsRes.json() : []);
    } catch (error) {
      toast.error('Failed to load expenses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const createExpense = async () => {
    if (!form.technicianId || !form.amount || !form.description) {
      toast.error('Technician, amount, and description are required');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/service/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          technicianId: form.technicianId,
          ticketId: form.ticketId && form.ticketId !== '__NONE__' ? form.ticketId : undefined,
          category: form.category,
          amount: Number(form.amount),
          distanceKm: form.distanceKm ? Number(form.distanceKm) : undefined,
          fromLocation: form.fromLocation || undefined,
          toLocation: form.toLocation || undefined,
          description: form.description,
        }),
      });

      if (!res.ok) throw new Error('Failed to create expense');
      toast.success('Expense submitted');
      setForm({
        technicianId: '',
        ticketId: '',
        category: 'TRAVEL',
        amount: '',
        distanceKm: '',
        fromLocation: '',
        toLocation: '',
        description: '',
      });
      loadData();
    } catch (error) {
      toast.error('Failed to create expense');
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (expenseId: string, status: string) => {
    try {
      const res = await fetch(`/api/service/expenses/${expenseId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (!res.ok) throw new Error('Failed to update status');
      toast.success(`Expense marked ${status.toLowerCase()}`);
      loadData();
    } catch (error) {
      toast.error('Failed to update expense status');
    }
  };

  if (loading) {
    return <div className="container mx-auto p-4 md:p-6 lg:p-8">Loading expenses...</div>;
  }

  if (!featureEnabled) {
    return (
      <div className="container mx-auto p-4 md:p-6 lg:p-8">
        <Card>
          <CardHeader><CardTitle>Module Disabled</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Travel & Expense is disabled by your Super Admin.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Travel & Expense</h1>
        <p className="text-sm text-muted-foreground">Capture site travel costs and reimbursements.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardDescription>Total Claims</CardDescription></CardHeader>
          <CardContent><p className="text-2xl font-bold">{stats?.totalCount || 0}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Total Amount</CardDescription></CardHeader>
          <CardContent><p className="text-2xl font-bold">{formatCurrency(stats?.totalAmount || 0, 'USD')}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Pending</CardDescription></CardHeader>
          <CardContent><p className="text-2xl font-bold text-yellow-600">{stats?.pendingCount || 0}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Approved/Reimbursed</CardDescription></CardHeader>
          <CardContent><p className="text-2xl font-bold text-green-600">{formatCurrency(stats?.approvedAmount || 0, 'USD')}</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Submit Expense</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(value) => setForm({ ...form, category: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TRAVEL">Travel</SelectItem>
                  <SelectItem value="LODGING">Lodging</SelectItem>
                  <SelectItem value="MEAL">Meal</SelectItem>
                  <SelectItem value="PARTS">Parts</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Distance (KM)</Label>
              <Input type="number" min="0" step="0.1" value={form.distanceKm} onChange={(e) => setForm({ ...form, distanceKm: e.target.value })} />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>From</Label>
              <Input value={form.fromLocation} onChange={(e) => setForm({ ...form, fromLocation: e.target.value })} placeholder="Start point" />
            </div>
            <div className="space-y-2">
              <Label>To</Label>
              <Input value={form.toLocation} onChange={(e) => setForm({ ...form, toLocation: e.target.value })} placeholder="Destination" />
            </div>
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
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>

          <Button onClick={createExpense} disabled={saving}>{saving ? 'Saving...' : 'Submit Expense'}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Expense Register</CardTitle></CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Technician</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No expenses found.</TableCell></TableRow>
                ) : (
                  expenses.map((expense: any) => (
                    <TableRow key={expense.id}>
                      <TableCell>{new Date(expense.expenseDate).toLocaleDateString()}</TableCell>
                      <TableCell>{expense.technician?.name || expense.technician?.email}</TableCell>
                      <TableCell><Badge variant="outline">{expense.category}</Badge></TableCell>
                      <TableCell>{formatCurrency(expense.amount, expense.currency)}</TableCell>
                      <TableCell><span className={`px-2 py-1 rounded text-xs font-semibold ${statusColors[expense.status] || 'bg-muted'}`}>{expense.status}</span></TableCell>
                      <TableCell>{expense.description}</TableCell>
                      <TableCell className="text-right space-x-2">
                        {expense.status === 'PENDING' && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => updateStatus(expense.id, 'APPROVED')}>Approve</Button>
                            <Button size="sm" variant="destructive" onClick={() => updateStatus(expense.id, 'REJECTED')}>Reject</Button>
                          </>
                        )}
                        {expense.status === 'APPROVED' && (
                          <Button size="sm" onClick={() => updateStatus(expense.id, 'REIMBURSED')}>Mark Reimbursed</Button>
                        )}
                      </TableCell>
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
