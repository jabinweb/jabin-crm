'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Loader2, Plus, RefreshCw, Repeat } from 'lucide-react';
import { toast } from 'sonner';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { FullTableSkeleton } from '@/components/loading';
import { cn } from '@/lib/utils';

type Retainer = {
  id: string;
  name: string;
  amount: number;
  currency: string;
  billingCycle: string;
  status: string;
  nextBillAt: string | null;
  customer?: { id: string; organizationName: string } | null;
  project?: { id: string; name: string } | null;
};

export default function RetainersPage() {
  const { slug, path, workspaceFetch } = useWorkspacePaths();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [billingCycle, setBillingCycle] = useState('MONTHLY');
  const [projectId, setProjectId] = useState('');

  const { data: retainers = [], isLoading } = useQuery({
    queryKey: ['retainers', slug],
    queryFn: async () => {
      const res = await workspaceFetch('/api/retainers');
      if (!res.ok) throw new Error('Failed to load retainers');
      return (await res.json()) as Retainer[];
    },
    enabled: !!slug,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['retainer-customers', slug],
    queryFn: async () => {
      const res = await workspaceFetch('/api/customers?limit=100');
      if (!res.ok) return [];
      const json = await res.json();
      return (json.customers || json || []) as Array<{
        id: string;
        organizationName: string;
      }>;
    },
    enabled: !!slug,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['retainer-projects', slug],
    queryFn: async () => {
      const res = await workspaceFetch('/api/projects');
      if (!res.ok) return [];
      return (await res.json()) as Array<{ id: string; name: string }>;
    },
    enabled: !!slug,
  });

  const resetForm = () => {
    setName('');
    setAmount('');
    setCustomerId('');
    setBillingCycle('MONTHLY');
    setProjectId('');
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await workspaceFetch('/api/retainers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          amount: Number(amount),
          customerId,
          billingCycle,
          projectId: projectId || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Retainer created');
      resetForm();
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['retainers', slug] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const billMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await workspaceFetch(`/api/retainers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'bill_now' }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to bill');
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(`Draft invoice ${data.invoice?.invoiceNumber || ''} created`);
      queryClient.invalidateQueries({ queryKey: ['retainers', slug] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mrr = useMemo(
    () =>
      retainers
        .filter((r) => r.status === 'ACTIVE')
        .reduce((sum, r) => {
          if (r.billingCycle === 'YEARLY') return sum + r.amount / 12;
          if (r.billingCycle === 'QUARTERLY') return sum + r.amount / 3;
          return sum + r.amount;
        }, 0),
    [retainers]
  );

  const activeCount = retainers.filter((r) => r.status === 'ACTIVE').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Client retainers
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Recurring plans — SEO, hosting, care — with draft invoice generation.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href={path('/dashboard/projects')}>Projects</Link>
          </Button>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New retainer
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-md bg-muted p-2 text-muted-foreground">
              <Repeat className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Active retainers</p>
              <p className="text-xl font-semibold tabular-nums">{activeCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Estimated MRR</p>
            <p className="text-xl font-semibold tabular-nums">
              {mrr.toLocaleString(undefined, {
                maximumFractionDigits: 0,
              })}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4">
          {isLoading ? (
            <FullTableSkeleton columnCount={6} rowCount={5} />
          ) : retainers.length === 0 ? (
            <EmptyState
              icon={Repeat}
              title="No retainers yet"
              description="Add monthly or yearly client plans to track MRR and generate invoices."
              actionLabel="New retainer"
              onAction={() => setDialogOpen(true)}
            />
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Next bill</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[120px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {retainers.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{r.name}</p>
                          {r.project && (
                            <Link
                              href={path(`/dashboard/projects/${r.project.id}`)}
                              className="text-xs text-muted-foreground hover:underline"
                            >
                              {r.project.name}
                            </Link>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{r.customer?.organizationName ?? '—'}</TableCell>
                      <TableCell className="tabular-nums text-sm">
                        {r.currency} {r.amount.toLocaleString()}
                        <span className="text-muted-foreground">
                          {' '}
                          / {r.billingCycle.toLowerCase()}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.nextBillAt
                          ? new Date(r.nextBillAt).toLocaleDateString(undefined, {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })
                          : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            'font-medium',
                            r.status === 'ACTIVE' &&
                              'bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400'
                          )}
                        >
                          {r.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {r.status === 'ACTIVE' && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={billMutation.isPending}
                            onClick={() => billMutation.mutate(r.id)}
                          >
                            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                            Bill
                          </Button>
                        )}
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
            <DialogTitle>New retainer</DialogTitle>
            <DialogDescription>
              Recurring billing plan for a client engagement.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Monthly SEO"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Amount</Label>
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="500"
                />
              </div>
              <div className="space-y-2">
                <Label>Billing cycle</Label>
                <Select value={billingCycle} onValueChange={setBillingCycle}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MONTHLY">Monthly</SelectItem>
                    <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                    <SelectItem value="YEARLY">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Client</Label>
              <Select value={customerId || undefined} onValueChange={setCustomerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.organizationName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Project (optional)</Label>
              <Select
                value={projectId || '__none__'}
                onValueChange={(v) => setProjectId(v === '__none__' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                !name.trim() || !customerId || !amount || createMutation.isPending
              }
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create retainer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
