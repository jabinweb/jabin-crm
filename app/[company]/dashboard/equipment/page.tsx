'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
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
import { Plus, Wrench } from 'lucide-react';
import { TableSkeleton } from '@/components/loading';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';

type FleetRow = {
  id: string;
  serialNumber: string | null;
  status: string;
  installationDate: string;
  warrantyExpiry: string | null;
  serviceRequestToken: string | null;
  product: { id: string; name: string; modelNumber: string | null; sku: string | null };
  customer: { id: string; organizationName: string; city: string | null };
  serviceContracts: Array<{
    id: string;
    type: string;
    title: string;
    endDate: string;
    contractNumber: string | null;
  }>;
};

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function EquipmentFleetPage() {
  const { path, workspaceFetch } = useWorkspacePaths();
  const [status, setStatus] = useState('all');
  const [contractFilter, setContractFilter] = useState('all');
  const [warrantyFilter, setWarrantyFilter] = useState('all');

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (status !== 'all') params.set('status', status);
    if (contractFilter === 'yes') params.set('hasContract', '1');
    if (contractFilter === 'no') params.set('hasContract', '0');
    if (warrantyFilter === '90') params.set('warrantyExpiring', '90');
    return params.toString();
  }, [status, contractFilter, warrantyFilter]);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['equipment-fleet', queryString],
    queryFn: async () => {
      const res = await workspaceFetch(
        `/api/inventory/installations${queryString ? `?${queryString}` : ''}`
      );
      if (!res.ok) throw new Error('Failed to load fleet');
      return (await res.json()) as FleetRow[];
    },
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Equipment fleet</h1>
          <p className="text-muted-foreground text-sm">
            Company-wide serial register with warranty and active AMC/CMC.
          </p>
        </div>
        <Button asChild>
          <Link href={path('/dashboard/inventory/new')}>
            <Plus className="mr-2 h-4 w-4" />
            Register unit
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
          <CardDescription>Narrow by status, contract coverage, or warranty window.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="UNDER_MAINTENANCE">Under maintenance</SelectItem>
              <SelectItem value="DECOMMISSIONED">Decommissioned</SelectItem>
            </SelectContent>
          </Select>
          <Select value={contractFilter} onValueChange={setContractFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Contract" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any contract</SelectItem>
              <SelectItem value="yes">Has active AMC/CMC</SelectItem>
              <SelectItem value="no">No active contract</SelectItem>
            </SelectContent>
          </Select>
          <Select value={warrantyFilter} onValueChange={setWarrantyFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Warranty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any warranty</SelectItem>
              <SelectItem value="90">Warranty expiring in 90d</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <TableSkeleton columnCount={7} />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={Wrench}
              title="No installed units"
              description="Register equipment against a customer to build the fleet board."
              actionLabel="Register unit"
              actionHref={path('/dashboard/inventory/new')}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Serial</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Warranty</TableHead>
                  <TableHead>AMC / CMC</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const contract = row.serviceContracts[0];
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">
                        {row.serialNumber || '—'}
                      </TableCell>
                      <TableCell>
                        <div>{row.product.name}</div>
                        {row.product.modelNumber ? (
                          <div className="text-muted-foreground text-xs">
                            {row.product.modelNumber}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={path(`/dashboard/customers/${row.customer.id}`)}
                          className="hover:underline"
                        >
                          {row.customer.organizationName}
                        </Link>
                        {row.customer.city ? (
                          <div className="text-muted-foreground text-xs">{row.customer.city}</div>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{row.status.replace(/_/g, ' ')}</Badge>
                      </TableCell>
                      <TableCell>{formatDate(row.warrantyExpiry)}</TableCell>
                      <TableCell>
                        {contract ? (
                          <Link
                            href={path(`/dashboard/contracts`)}
                            className="hover:underline text-sm"
                          >
                            {contract.type}
                            {contract.contractNumber ? ` · ${contract.contractNumber}` : ''}
                            <div className="text-muted-foreground text-xs">
                              ends {formatDate(contract.endDate)}
                            </div>
                          </Link>
                        ) : (
                          <span className="text-muted-foreground text-sm">None</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={path(`/dashboard/customers/${row.customer.id}`)}>
                            Open
                          </Link>
                        </Button>
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
