'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/ui/empty-state';
import { Loader2, Receipt, PiggyBank, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { FullTableSkeleton } from '@/components/loading';
import { confirmAction } from '@/lib/confirm-action';

type Expense = {
  id: string;
  description: string;
  amount: number;
  date: string;
};

type Budget = {
  id: string;
  year: number;
  amount: number;
};

type Asset = {
  id: string;
  name: string;
};

function toDateInput(value?: string | null) {
  if (!value) return '';
  return value.slice(0, 10);
}

export default function ExpensesPage() {
  const { slug, path, workspaceFetch } = useWorkspacePaths();
  const queryClient = useQueryClient();
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [editing, setEditing] = useState<Expense | null>(null);
  const currentYear = new Date().getFullYear();

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['expenses', slug],
    queryFn: async () => {
      const res = await workspaceFetch('/api/expenses');
      if (!res.ok) throw new Error('Failed to load expenses');
      return (await res.json()) as Expense[];
    },
    enabled: !!slug,
  });

  const { data: budgets = [] } = useQuery({
    queryKey: ['budgets', slug],
    queryFn: async () => {
      const res = await workspaceFetch('/api/budgets');
      if (!res.ok) throw new Error('Failed to load budgets');
      return (await res.json()) as Budget[];
    },
    enabled: !!slug,
  });

  const { data: assets = [] } = useQuery({
    queryKey: ['assets', slug],
    queryFn: async () => {
      const res = await workspaceFetch('/api/assets');
      if (!res.ok) throw new Error('Failed to load assets');
      return (await res.json()) as Asset[];
    },
    enabled: !!slug,
  });

  const expenseTotal = useMemo(
    () => expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
    [expenses]
  );

  const budgetYearTotal = useMemo(
    () =>
      budgets
        .filter((b) => b.year === currentYear)
        .reduce((sum, b) => sum + (Number(b.amount) || 0), 0),
    [budgets, currentYear]
  );

  const resetForm = () => {
    setDescription('');
    setAmount('');
    setDate('');
    setEditing(null);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        description,
        amount: Number(amount),
        date: date || undefined,
      };
      if (editing) {
        const res = await workspaceFetch(`/api/expenses/${editing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to update');
        }
        return res.json();
      }
      const res = await workspaceFetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success(editing ? 'Expense updated' : 'Expense recorded');
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['expenses', slug] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await workspaceFetch(`/api/expenses/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to delete');
      }
    },
    onSuccess: () => {
      toast.success('Expense deleted');
      if (editing) resetForm();
      queryClient.invalidateQueries({ queryKey: ['expenses', slug] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const startEdit = (e: Expense) => {
    setEditing(e);
    setDescription(e.description);
    setAmount(String(e.amount));
    setDate(toDateInput(e.date));
  };

  const confirmDeleteExpense = async (id: string) => {
    if (
      !(await confirmAction({
        title: 'Delete this expense?',
        description: 'This cannot be undone.',
        confirmLabel: 'Delete',
        variant: 'destructive',
      }))
    )
      return;
    deleteMutation.mutate(id);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Expenses</h1>
          <p className="text-sm text-muted-foreground">Company operating expenses.</p>
        </div>
        <Button variant="outline" asChild>
          <Link href={path('/dashboard/settings/migration')}>Import CSV</Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3">
        <Card className="min-w-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="truncate text-sm font-medium text-muted-foreground">
              Expenses total
            </CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="truncate text-xl font-semibold tabular-nums sm:text-2xl">
              {expenseTotal.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">{expenses.length} recorded</p>
          </CardContent>
        </Card>
        <Card className="min-w-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="truncate text-sm font-medium text-muted-foreground">
              Budget {currentYear}
            </CardTitle>
            <PiggyBank className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="truncate text-xl font-semibold tabular-nums sm:text-2xl">
              {budgetYearTotal.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Sum of budgets for this year</p>
          </CardContent>
        </Card>
        <Card className="min-w-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="truncate text-sm font-medium text-muted-foreground">Assets</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="truncate text-xl font-semibold tabular-nums sm:text-2xl">{assets.length}</div>
            <p className="text-xs text-muted-foreground">Tracked assets</p>
          </CardContent>
        </Card>
      </div>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle className="text-base">
            {editing ? 'Edit expense' : 'New expense'}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2 sm:col-span-3">
            <Label htmlFor="exp-desc">Description</Label>
            <Input
              id="exp-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="exp-amount">Amount</Label>
            <Input
              id="exp-amount"
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="exp-date">Date</Label>
            <Input
              id="exp-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <Button
              disabled={!description.trim() || !amount || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? 'Save changes' : 'Add expense'}
            </Button>
            {editing && (
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancel
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle className="text-base">All expenses</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <FullTableSkeleton columnCount={3} rowCount={5} />
          ) : expenses.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="No expenses yet"
              description="Record a company expense above."
            />
          ) : (
            <>
            <div className="divide-y rounded-md border md:hidden">
              {expenses.map((e) => (
                <div key={e.id} className="flex items-start justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{e.description}</p>
                    <p className="text-xs text-muted-foreground">
                      <span className="tabular-nums">{e.amount.toLocaleString()}</span> ·{' '}
                      {new Date(e.date).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="sm" className="h-10" onClick={() => startEdit(e)}>
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-10"
                      onClick={() => confirmDeleteExpense(e.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-[140px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.description}</TableCell>
                    <TableCell className="text-right">{e.amount.toLocaleString()}</TableCell>
                    <TableCell>{new Date(e.date).toLocaleDateString()}</TableCell>
                    <TableCell className="space-x-1">
                      <Button variant="ghost" size="sm" onClick={() => startEdit(e)}>
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => confirmDeleteExpense(e.id)}
                      >
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
