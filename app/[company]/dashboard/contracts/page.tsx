'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { Loader2, Plus, FileText } from 'lucide-react';
import { useState } from 'react';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { daysUntil, renewalUrgency } from '@/lib/crm/service-contract-utils';

type ContractRow = {
  id: string;
  type: 'AMC' | 'CMC';
  status: string;
  title: string;
  contractNumber: string | null;
  startDate: string;
  endDate: string;
  annualValue: number | null;
  currency: string;
  includesParts: boolean;
  customer: { id: string; organizationName: string; city: string | null };
  equipment: {
    id: string;
    serialNumber: string | null;
    product: { name: string; modelNumber: string | null } | null;
  } | null;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function statusVariant(
  status: string
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'ACTIVE':
      return 'default';
    case 'EXPIRED':
      return 'destructive';
    case 'CANCELLED':
      return 'outline';
    default:
      return 'secondary';
  }
}

export default function ContractsPage() {
  const { slug, path, workspaceFetch } = useWorkspacePaths();
  const [status, setStatus] = useState<string>('all');
  const [type, setType] = useState<string>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['contracts', slug, status, type],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status !== 'all') params.set('status', status);
      if (type !== 'all') params.set('type', type);
      const qs = params.toString();
      const res = await workspaceFetch(`/api/contracts${qs ? `?${qs}` : ''}`);
      if (!res.ok) throw new Error('Failed to load contracts');
      return res.json() as Promise<{ contracts: ContractRow[] }>;
    },
    enabled: !!slug,
  });

  const contracts = data?.contracts ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b pb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">AMC / CMC contracts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track maintenance agreements and renewals before they lapse.
          </p>
        </div>
        <Button asChild size="sm">
          <Link href={path('/dashboard/contracts/new')}>
            <Plus className="w-4 h-4 mr-1.5" /> New contract
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="EXPIRED">Expired</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">AMC & CMC</SelectItem>
            <SelectItem value="AMC">AMC</SelectItem>
            <SelectItem value="CMC">CMC</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Contracts</CardTitle>
          <CardDescription>
            Sorted by end date — renewals due soon appear first.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !contracts.length ? (
            <EmptyState
              icon={FileText}
              title="No contracts yet"
              description="Add an AMC or CMC when you sell annual maintenance coverage."
              actionLabel="New contract"
              actionHref={path('/dashboard/contracts/new')}
              className="py-10"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contract</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ends</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.map((c) => {
                  const left = daysUntil(new Date(c.endDate));
                  const urgency =
                    c.status === 'ACTIVE' ? renewalUrgency(left) : 'ok';
                  return (
                    <TableRow key={c.id}>
                      <TableCell>
                        <Link
                          href={path(`/dashboard/contracts/${c.id}`)}
                          className="font-medium hover:underline"
                        >
                          {c.title}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          {c.contractNumber || c.id.slice(0, 8)}
                          {c.equipment?.product?.name
                            ? ` · ${c.equipment.product.name}`
                            : ''}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={path(`/dashboard/customers/${c.customer.id}`)}
                          className="hover:underline"
                        >
                          {c.customer.organizationName}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{c.type}</Badge>
                        {c.includesParts ? (
                          <span className="ml-1 text-[10px] text-muted-foreground">
                            +parts
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(c.status)}>
                          {c.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div>{formatDate(c.endDate)}</div>
                        {c.status === 'ACTIVE' && (
                          <div
                            className={
                              urgency === 'overdue' || urgency === 'critical'
                                ? 'text-xs text-destructive'
                                : urgency === 'soon'
                                  ? 'text-xs text-amber-700'
                                  : 'text-xs text-muted-foreground'
                            }
                          >
                            {left < 0
                              ? `${Math.abs(left)}d overdue`
                              : left === 0
                                ? 'Ends today'
                                : `${left}d left`}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {c.annualValue != null
                          ? `${c.currency} ${c.annualValue.toLocaleString()}`
                          : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
