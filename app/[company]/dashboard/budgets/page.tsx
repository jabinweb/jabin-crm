'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Loader2, PiggyBank, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { FullTableSkeleton } from '@/components/loading';
import { confirmAction } from '@/lib/confirm-action';

type Budget = {
  id: string;
  year: number;
  amount: number;
  createdAt: string;
  projectId?: string | null;
  project?: { id: string; name: string } | null;
};

export default function BudgetsPage() {
  const { slug, path, workspaceFetch } = useWorkspacePaths();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [amount, setAmount] = useState('');
  const [projectId, setProjectId] = useState('');
  const [editing, setEditing] = useState<Budget | null>(null);

  const { data: budgets = [], isLoading } = useQuery({
    queryKey: ['budgets', slug],
    queryFn: async () => {
      const res = await workspaceFetch('/api/budgets');
      if (!res.ok) throw new Error('Failed to load budgets');
      return (await res.json()) as Budget[];
    },
    enabled: !!slug,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['budget-projects', slug],
    queryFn: async () => {
      const res = await workspaceFetch('/api/projects');
      if (!res.ok) return [];
      return (await res.json()) as Array<{ id: string; name: string }>;
    },
    enabled: !!slug,
  });

  const resetForm = () => {
    setYear(String(new Date().getFullYear()));
    setAmount('');
    setProjectId('');
    setEditing(null);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (b: Budget) => {
    setEditing(b);
    setYear(String(b.year));
    setAmount(String(b.amount));
    setProjectId(b.projectId || b.project?.id || '');
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        year: Number(year),
        amount: Number(amount),
        projectId: projectId || null,
      };
      if (editing) {
        const res = await workspaceFetch(`/api/budgets/${editing.id}`, {
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
      const res = await workspaceFetch('/api/budgets', {
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
      toast.success(editing ? 'Budget updated' : 'Budget created');
      resetForm();
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['budgets', slug] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await workspaceFetch(`/api/budgets/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to delete');
      }
    },
    onSuccess: () => {
      toast.success('Budget deleted');
      queryClient.invalidateQueries({ queryKey: ['budgets', slug] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Budgets</h1>
          <p className="text-sm text-muted-foreground">
            Annual company budgets, optionally tagged to a project.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href={path('/dashboard/settings/migration')}>Import CSV</Link>
          </Button>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            New budget
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          {isLoading ? (
            <FullTableSkeleton columnCount={3} rowCount={5} />
          ) : budgets.length === 0 ? (
            <EmptyState
              icon={PiggyBank}
              title="No budgets yet"
              description="Add an annual budget to get started."
              actionLabel="New budget"
              onAction={openCreate}
            />
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Year</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-[140px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {budgets.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">{b.year}</TableCell>
                      <TableCell>{b.project?.name || '—'}</TableCell>
                      <TableCell className="text-right">{b.amount.toLocaleString()}</TableCell>
                      <TableCell>{new Date(b.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell className="space-x-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(b)}>
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            if (
                              !(await confirmAction({
                                title: 'Delete this budget?',
                                description: 'This cannot be undone.',
                                confirmLabel: 'Delete',
                                variant: 'destructive',
                              }))
                            )
                              return;
                            deleteMutation.mutate(b.id);
                          }}
                        >
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit budget' : 'New budget'}</DialogTitle>
            <DialogDescription>
              {editing
                ? 'Update this annual budget entry.'
                : 'Create an annual company budget, optionally linked to a project.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
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
            <div className="space-y-2">
              <Label>Project (optional)</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
              >
                <option value="">None</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={!year || !amount || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? 'Save changes' : 'Create budget'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
