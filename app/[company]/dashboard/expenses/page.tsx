'use client';

import { useMemo, useState } from 'react';
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

export default function ExpensesPage() {
  const { slug, workspaceFetch } = useWorkspacePaths();
  const queryClient = useQueryClient();
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
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

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await workspaceFetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description,
          amount: Number(amount),
          date: date || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Expense recorded');
      setDescription('');
      setAmount('');
      setDate('');
      queryClient.invalidateQueries({ queryKey: ['expenses', slug] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Expenses</h1>
        <p className="text-sm text-muted-foreground">Company operating expenses.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Expenses total
            </CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">
              {expenseTotal.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">{expenses.length} recorded</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Budget {currentYear}
            </CardTitle>
            <PiggyBank className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">
              {budgetYearTotal.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Sum of budgets for this year</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Assets</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">{assets.length}</div>
            <p className="text-xs text-muted-foreground">Tracked assets</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">New expense</CardTitle>
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
          <div className="flex items-end">
            <Button
              disabled={!description.trim() || !amount || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add expense
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.description}</TableCell>
                    <TableCell className="text-right">{e.amount.toLocaleString()}</TableCell>
                    <TableCell>{new Date(e.date).toLocaleDateString()}</TableCell>
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
