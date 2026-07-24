'use client';

import { useState } from 'react';
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
import { Loader2, PiggyBank } from 'lucide-react';
import { toast } from 'sonner';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { FullTableSkeleton } from '@/components/loading';

type Budget = {
  id: string;
  year: number;
  amount: number;
  createdAt: string;
};

export default function BudgetsPage() {
  const { slug, workspaceFetch } = useWorkspacePaths();
  const queryClient = useQueryClient();
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [amount, setAmount] = useState('');

  const { data: budgets = [], isLoading } = useQuery({
    queryKey: ['budgets', slug],
    queryFn: async () => {
      const res = await workspaceFetch('/api/budgets');
      if (!res.ok) throw new Error('Failed to load budgets');
      return (await res.json()) as Budget[];
    },
    enabled: !!slug,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await workspaceFetch('/api/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: Number(year), amount: Number(amount) }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Budget created');
      setAmount('');
      queryClient.invalidateQueries({ queryKey: ['budgets', slug] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Budgets</h1>
        <p className="text-sm text-muted-foreground">Annual company budgets.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">New budget</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="budget-year">Year</Label>
            <Input
              id="budget-year"
              type="number"
              min={2000}
              max={2100}
              value={year}
              onChange={(e) => setYear(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="budget-amount">Amount</Label>
            <Input
              id="budget-amount"
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button
              disabled={!year || !amount || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create budget
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All budgets</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <FullTableSkeleton columnCount={3} rowCount={5} />
          ) : budgets.length === 0 ? (
            <EmptyState
              icon={PiggyBank}
              title="No budgets yet"
              description="Add an annual budget above."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Year</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {budgets.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.year}</TableCell>
                    <TableCell className="text-right">{b.amount.toLocaleString()}</TableCell>
                    <TableCell>{new Date(b.createdAt).toLocaleDateString()}</TableCell>
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
