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
import { Plus, FileText, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { TableSkeleton } from '@/components/loading';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { daysUntil, renewalUrgency } from '@/lib/crm/service-contract-utils';
import { humanizeEnum } from '@/lib/crm/humanize-enum';
import { formatCurrency } from '@/lib/currency';

function formatValue(amount: number | null, currency: string) {
  return amount != null ? formatCurrency(amount, currency) : '—';
}

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
  visitLimit: number | null;
  visitsUsed: number;
  remaining: number | null;
  overLimit: boolean;
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

  const { data, isLoading, isError, refetch } = useQuery({
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between border-b pb-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">AMC / CMC contracts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track maintenance agreements and renewals before they lapse.
          </p>
        </div>
        <Button asChild size="sm" className="self-start sm:self-auto">
          <Link href={path('/dashboard/contracts/new')}>
            <Plus className="w-4 h-4 mr-1.5" /> New contract
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-44">
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
          <SelectTrigger className="w-full sm:w-36">
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
            <TableSkeleton columnCount={5} rowCount={5} />
          ) : isError ? (
            <EmptyState
              icon={AlertCircle}
              title="Couldn't load contracts"
              description="Check your connection and try again."
              actionLabel="Retry"
              onAction={() => void refetch()}
              className="py-10"
            />
          ) : !contracts.length ? (
            status !== 'all' || type !== 'all' ? (
              <EmptyState
                icon={FileText}
                title="No contracts match these filters"
                description="Try a different status or type."
                actionLabel="Clear filters"
                onAction={() => {
                  setStatus('all');
                  setType('all');
                }}
                className="py-10"
              />
            ) : (
              <EmptyState
                icon={FileText}
                title="No contracts yet"
                description="Add an AMC or CMC when you sell annual maintenance coverage."
                actionLabel="New contract"
                actionHref={path('/dashboard/contracts/new')}
                className="py-10"
              />
            )
          ) : (
            <>
            <div className="divide-y rounded-md border md:hidden">
              {contracts.map((c) => {
                const left = daysUntil(new Date(c.endDate));
                const urgency =
                  c.status === 'ACTIVE' ? renewalUrgency(left) : 'ok';
                return (
                  <Link
                    key={c.id}
                    href={path(`/dashboard/contracts/${c.id}`)}
                    className="block space-y-1.5 p-3 active:bg-muted/50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{c.title}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {c.customer.organizationName}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Badge variant="outline">{c.type}</Badge>
                        <Badge variant={statusVariant(c.status)}>{humanizeEnum(c.status)}</Badge>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="min-w-0 truncate text-muted-foreground">
                        Ends {formatDate(c.endDate)}
                        {c.status === 'ACTIVE' && (
                          <span
                            className={
                              urgency === 'overdue' || urgency === 'critical'
                                ? ' text-destructive'
                                : urgency === 'soon'
                                  ? ' text-amber-700 dark:text-amber-400'
                                  : ''
                            }
                          >
                            {' · '}
                            {left < 0
                              ? `${Math.abs(left)}d overdue`
                              : left === 0
                                ? 'Ends today'
                                : `${left}d left`}
                          </span>
                        )}
                        {c.visitLimit != null ? (
                          <span className={c.overLimit ? ' text-destructive' : ''}>
                            {' · '}
                            {c.visitsUsed}/{c.visitLimit} visits
                          </span>
                        ) : null}
                      </span>
                      <span className="shrink-0 tabular-nums font-medium">
                        {formatValue(c.annualValue, c.currency)}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
            <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contract</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Visits</TableHead>
                  <TableHead>Ends</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.map((c) => {
                  const left = daysUntil(new Date(c.endDate));
                  const urgency =
                    c.status === 'ACTIVE' ? renewalUrgency(left) : 'ok';
                  const visitPct =
                    c.visitLimit != null && c.visitLimit > 0
                      ? Math.min(100, Math.round((c.visitsUsed / c.visitLimit) * 100))
                      : null;
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
                          {humanizeEnum(c.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {c.visitLimit != null ? (
                          <div className="min-w-[88px]">
                            <div
                              className={
                                c.overLimit
                                  ? 'text-xs text-destructive tabular-nums'
                                  : 'text-xs tabular-nums'
                              }
                            >
                              {c.visitsUsed}/{c.visitLimit}
                            </div>
                            <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div
                                className={
                                  c.overLimit
                                    ? 'h-full bg-destructive'
                                    : visitPct != null && visitPct >= 80
                                      ? 'h-full bg-amber-500'
                                      : 'h-full bg-primary'
                                }
                                style={{ width: `${visitPct ?? 0}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>{formatDate(c.endDate)}</div>
                        {c.status === 'ACTIVE' && (
                          <div
                            className={
                              urgency === 'overdue' || urgency === 'critical'
                                ? 'text-xs text-destructive'
                                : urgency === 'soon'
                                  ? 'text-xs text-amber-700 dark:text-amber-400'
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
                        {formatValue(c.annualValue, c.currency)}
                      </TableCell>
                    </TableRow>
                  );
                })}
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
