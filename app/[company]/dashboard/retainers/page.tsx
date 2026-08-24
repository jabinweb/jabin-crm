'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { EmptyState } from '@/components/ui/empty-state';
import { Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { FullTableSkeleton } from '@/components/loading';

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
      setName('');
      setAmount('');
      setCustomerId('');
      setProjectId('');
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

  const mrr = retainers
    .filter((r) => r.status === 'ACTIVE')
    .reduce((sum, r) => {
      if (r.billingCycle === 'YEARLY') return sum + r.amount / 12;
      if (r.billingCycle === 'QUARTERLY') return sum + r.amount / 3;
      return sum + r.amount;
    }, 0);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Client retainers</h1>
          <p className="text-sm text-muted-foreground">
            Recurring plans (SEO, hosting, care) — separate from your Opslane subscription.
          </p>
        </div>
        <Card className="px-4 py-3">
          <p className="text-xs text-muted-foreground">Estimated MRR</p>
          <p className="text-xl font-semibold">{mrr.toFixed(0)}</p>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">New retainer</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Monthly SEO" />
          </div>
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
          <div className="space-y-2">
            <Label>Client</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            >
              <option value="">Select client</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.organizationName}
                </option>
              ))}
            </select>
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
          <div className="flex items-end">
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
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <FullTableSkeleton columnCount={6} rowCount={5} />
          ) : retainers.length === 0 ? (
            <EmptyState
              title="No retainers yet"
              description="Add monthly or yearly client plans to track MRR and generate invoices."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Next bill</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
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
                            className="text-xs text-muted-foreground underline"
                          >
                            {r.project.name}
                          </Link>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{r.customer?.organizationName}</TableCell>
                    <TableCell>
                      {r.currency} {r.amount} / {r.billingCycle.toLowerCase()}
                    </TableCell>
                    <TableCell>
                      {r.nextBillAt
                        ? new Date(r.nextBillAt).toLocaleDateString()
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{r.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {r.status === 'ACTIVE' && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={billMutation.isPending}
                          onClick={() => billMutation.mutate(r.id)}
                        >
                          <RefreshCw className="mr-1 h-3 w-3" />
                          Bill now
                        </Button>
                      )}
                    </TableCell>
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
