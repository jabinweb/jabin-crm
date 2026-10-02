'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
import { AlertCircle, Loader2, Plus, RefreshCw, Repeat } from 'lucide-react';
import { toast } from 'sonner';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { FullTableSkeleton } from '@/components/loading';
import { cn } from '@/lib/utils';
import { humanizeEnum } from '@/lib/crm/humanize-enum';
import { formatCurrency } from '@/lib/currency';
import { useCurrency } from '@/hooks/use-currency';

function formatShortDate(iso: string | null) {
  return iso
    ? new Date(iso).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '—';
}

type Retainer = {
  id: string;
  name: string;
  amount: number;
  currency: string;
  billingCycle: string;
  status: string;
  nextBillAt: string | null;
  includedHours?: number | null;
  customer?: { id: string; organizationName: string } | null;
  project?: { id: string; name: string } | null;
};

export default function RetainersPage() {
  const { slug, path, workspaceFetch } = useWorkspacePaths();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [billingCycle, setBillingCycle] = useState('MONTHLY');
  const [projectId, setProjectId] = useState('');
  const [includedHours, setIncludedHours] = useState('');

  const { currency: defaultCurrency } = useCurrency();
  const { data: retainers = [], isLoading, isError, refetch } = useQuery({
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
    setIncludedHours('');
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const hours =
        includedHours.trim() === '' ? null : Number(includedHours);
      const res = await workspaceFetch('/api/retainers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          amount: Number(amount),
          customerId,
          billingCycle,
          projectId: projectId || null,
          includedHours:
            hours != null && Number.isFinite(hours) && hours >= 0
              ? hours
              : null,
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
      const invoiceId = data.invoice?.id as string | undefined;
      const number = data.invoice?.invoiceNumber || '';
      toast.success(`Draft invoice ${number} created`, {
        action: invoiceId
          ? {
              label: 'Open invoice',
              onClick: () => router.push(path(`/dashboard/invoices/${invoiceId}`)),
            }
          : undefined,
      });
      queryClient.invalidateQueries({ queryKey: ['retainers', slug] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Monthly recurring revenue per currency — amounts in different
  // currencies are never summed together.
  const mrrByCurrency = useMemo(() => {
    const totals = new Map<string, number>();
    for (const r of retainers) {
      if (r.status !== 'ACTIVE') continue;
      const monthly =
        r.billingCycle === 'YEARLY'
          ? r.amount / 12
          : r.billingCycle === 'QUARTERLY'
            ? r.amount / 3
            : r.amount;
      totals.set(r.currency, (totals.get(r.currency) ?? 0) + monthly);
    }
    return Array.from(totals.entries());
  }, [retainers]);

  const mrrLabel =
    mrrByCurrency.length === 0
      ? formatCurrency(0, defaultCurrency, { maximumFractionDigits: 0 })
      : mrrByCurrency
          .map(([cur, total]) =>
            formatCurrency(total, cur, { maximumFractionDigits: 0 })
          )
          .join(' + ');

  const activeCount = retainers.filter((r) => r.status === 'ACTIVE').length;

  const amountValue = Number(amount);
  const canCreate =
    !!name.trim() &&
    !!customerId &&
    amount.trim() !== '' &&
    Number.isFinite(amountValue) &&
    amountValue > 0 &&
    !createMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">
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

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="shrink-0 rounded-md bg-muted p-2 text-muted-foreground">
              <Repeat className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs text-muted-foreground">Active retainers</p>
              <p className="truncate text-xl font-semibold tabular-nums">
                {isLoading ? '—' : activeCount}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="truncate text-xs text-muted-foreground">Estimated MRR</p>
            <p className="truncate text-xl font-semibold tabular-nums" title={mrrLabel}>
              {isLoading ? '—' : mrrLabel}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4">
          {isLoading ? (
            <FullTableSkeleton columnCount={6} rowCount={5} />
          ) : isError ? (
            <EmptyState
              icon={AlertCircle}
              title="Couldn't load retainers"
              description="Check your connection and try again."
              actionLabel="Retry"
              onAction={() => void refetch()}
            />
          ) : retainers.length === 0 ? (
            <EmptyState
              icon={Repeat}
              title="No retainers yet"
              description="Add monthly or yearly client plans to track MRR and generate invoices."
              actionLabel="New retainer"
              onAction={() => setDialogOpen(true)}
            />
          ) : (
            <>
            <div className="divide-y rounded-md border md:hidden">
              {retainers.map((r) => (
                <div key={r.id} className="space-y-2 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{r.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {r.customer?.organizationName ?? '—'}
                      </p>
                      {r.project && (
                        <Link
                          href={path(`/dashboard/projects/${r.project.id}`)}
                          className="block truncate text-xs text-muted-foreground hover:underline"
                        >
                          {r.project.name}
                        </Link>
                      )}
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        'shrink-0 font-medium',
                        r.status === 'ACTIVE' &&
                          'bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400'
                      )}
                    >
                      {humanizeEnum(r.status)}
                    </Badge>
                  </div>
                  <div className="flex items-end justify-between gap-2">
                    <div className="min-w-0 text-sm tabular-nums">
                      {formatCurrency(r.amount, r.currency)}
                      <span className="text-muted-foreground">
                        {' '}
                        / {humanizeEnum(r.billingCycle).toLowerCase()}
                      </span>
                      <p className="text-xs text-muted-foreground">
                        Next bill{' '}
                        {formatShortDate(r.nextBillAt)}
                        {r.includedHours != null ? ` · ${r.includedHours}h included` : null}
                      </p>
                    </div>
                    {r.status === 'ACTIVE' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-10 shrink-0"
                        disabled={billMutation.isPending}
                        onClick={() => billMutation.mutate(r.id)}
                        aria-label={`Create draft invoice for ${r.name}`}
                      >
                        {billMutation.isPending && billMutation.variables === r.id ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        Bill now
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden rounded-md border overflow-x-auto md:block">
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
                        {formatCurrency(r.amount, r.currency)}
                        <span className="text-muted-foreground">
                          {' '}
                          / {humanizeEnum(r.billingCycle).toLowerCase()}
                        </span>
                        {r.includedHours != null ? (
                          <p className="text-xs text-muted-foreground">
                            {r.includedHours}h included
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatShortDate(r.nextBillAt)}
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
                          {humanizeEnum(r.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {r.status === 'ACTIVE' && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={billMutation.isPending}
                            onClick={() => billMutation.mutate(r.id)}
                            aria-label={`Create draft invoice for ${r.name}`}
                            title="Create a draft invoice for this cycle"
                          >
                            {billMutation.isPending && billMutation.variables === r.id ? (
                              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                            )}
                            Bill now
                          </Button>
                        )}
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
          <form
            id="new-retainer-form"
            className="grid gap-4 py-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!canCreate) return;
              createMutation.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="retainer-name">Name *</Label>
              <Input
                id="retainer-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Monthly SEO"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="retainer-amount">Amount *</Label>
                <Input
                  id="retainer-amount"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="retainer-cycle">Billing cycle</Label>
                <Select value={billingCycle} onValueChange={setBillingCycle}>
                  <SelectTrigger id="retainer-cycle">
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
              <Label htmlFor="retainer-client">Client *</Label>
              <Select
                value={customerId || undefined}
                onValueChange={setCustomerId}
                disabled={customers.length === 0}
              >
                <SelectTrigger id="retainer-client">
                  <SelectValue
                    placeholder={customers.length === 0 ? 'No clients yet' : 'Select client'}
                  />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.organizationName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {customers.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Retainers belong to a client.{' '}
                  <Link
                    href={path('/dashboard/customers/new')}
                    className="text-primary underline underline-offset-2"
                  >
                    Add a client
                  </Link>{' '}
                  first.
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="retainer-project">Project (optional)</Label>
              <Select
                value={projectId || '__none__'}
                onValueChange={(v) => setProjectId(v === '__none__' ? '' : v)}
              >
                <SelectTrigger id="retainer-project">
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
            <div className="space-y-2">
              <Label htmlFor="retainer-hours">Included hours / cycle (optional)</Label>
              <Input
                id="retainer-hours"
                type="number"
                inputMode="decimal"
                min={0}
                step={0.5}
                value={includedHours}
                onChange={(e) => setIncludedHours(e.target.value)}
                placeholder="e.g. 10"
              />
            </div>
          </form>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="new-retainer-form" disabled={!canCreate}>
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
