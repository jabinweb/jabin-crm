'use client';

import { useState } from 'react';
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
import { Loader2, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { FullTableSkeleton } from '@/components/loading';

type Asset = {
  id: string;
  name: string;
  type: string;
  value: number;
  purchaseDate: string;
  depreciation: number;
  equipmentInstallationId?: string | null;
  equipmentInstallation?: {
    id: string;
    serialNumber: string | null;
    product?: { name: string } | null;
    customer?: { organizationName: string } | null;
  } | null;
};

function toDateInput(value?: string | null) {
  if (!value) return '';
  return value.slice(0, 10);
}

export default function AssetsPage() {
  const { slug, path, workspaceFetch } = useWorkspacePaths();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [value, setValue] = useState('');
  const [depreciation, setDepreciation] = useState('0');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [equipmentInstallationId, setEquipmentInstallationId] = useState('');
  const [editing, setEditing] = useState<Asset | null>(null);

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['assets', slug],
    queryFn: async () => {
      const res = await workspaceFetch('/api/assets');
      if (!res.ok) throw new Error('Failed to load assets');
      return (await res.json()) as Asset[];
    },
    enabled: !!slug,
  });

  const { data: fleet = [] } = useQuery({
    queryKey: ['asset-fleet', slug],
    queryFn: async () => {
      const res = await workspaceFetch('/api/inventory/installations');
      if (!res.ok) return [];
      return (await res.json()) as Array<{
        id: string;
        serialNumber: string | null;
        product: { name: string };
        customer: { organizationName: string };
      }>;
    },
    enabled: !!slug,
  });

  const resetForm = () => {
    setName('');
    setType('');
    setValue('');
    setDepreciation('0');
    setPurchaseDate('');
    setEquipmentInstallationId('');
    setEditing(null);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        type,
        value: Number(value),
        depreciation: Number(depreciation || 0),
        purchaseDate: purchaseDate || undefined,
        equipmentInstallationId: equipmentInstallationId || null,
      };
      if (editing) {
        const res = await workspaceFetch(`/api/assets/${editing.id}`, {
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
      const res = await workspaceFetch('/api/assets', {
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
      toast.success(editing ? 'Asset updated' : 'Asset created');
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['assets', slug] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await workspaceFetch(`/api/assets/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to delete');
      }
    },
    onSuccess: () => {
      toast.success('Asset deleted');
      if (editing) resetForm();
      queryClient.invalidateQueries({ queryKey: ['assets', slug] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const startEdit = (a: Asset) => {
    setEditing(a);
    setName(a.name);
    setType(a.type);
    setValue(String(a.value));
    setDepreciation(String(a.depreciation ?? 0));
    setPurchaseDate(toDateInput(a.purchaseDate));
    setEquipmentInstallationId(
      a.equipmentInstallationId || a.equipmentInstallation?.id || ''
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Assets</h1>
          <p className="text-sm text-muted-foreground">
            Internal fixed-asset register. Installed customer equipment lives on{' '}
            <Link href={path('/dashboard/equipment')} className="text-primary underline">
              Fleet
            </Link>
            .
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href={path('/dashboard/settings/migration')}>Import CSV</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {editing ? `Edit ${editing.name}` : 'New asset'}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="asset-name">Name</Label>
            <Input id="asset-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="asset-type">Type</Label>
            <Input id="asset-type" value={type} onChange={(e) => setType(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="asset-value">Value</Label>
            <Input
              id="asset-value"
              type="number"
              min={0}
              step="0.01"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="asset-dep">Depreciation</Label>
            <Input
              id="asset-dep"
              type="number"
              min={0}
              step="0.01"
              value={depreciation}
              onChange={(e) => setDepreciation(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="asset-date">Purchase date</Label>
            <Input
              id="asset-date"
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Linked fleet unit (optional)</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={equipmentInstallationId}
              onChange={(e) => setEquipmentInstallationId(e.target.value)}
            >
              <option value="">None</option>
              {fleet.map((u) => (
                <option key={u.id} value={u.id}>
                  {[u.product?.name, u.serialNumber, u.customer?.organizationName]
                    .filter(Boolean)
                    .join(' · ')}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <Button
              disabled={!name.trim() || !type.trim() || !value || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? 'Save changes' : 'Create asset'}
            </Button>
            {editing && (
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancel
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All assets</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <FullTableSkeleton columnCount={5} rowCount={5} />
          ) : assets.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="No assets yet"
              description="Add a company asset above."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Fleet unit</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="text-right">Depreciation</TableHead>
                  <TableHead>Purchased</TableHead>
                  <TableHead className="w-[140px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {assets.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell>{a.type}</TableCell>
                    <TableCell>
                      {a.equipmentInstallation
                        ? [
                            a.equipmentInstallation.product?.name,
                            a.equipmentInstallation.serialNumber,
                          ]
                            .filter(Boolean)
                            .join(' · ')
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right">{a.value.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{a.depreciation.toLocaleString()}</TableCell>
                    <TableCell>{new Date(a.purchaseDate).toLocaleDateString()}</TableCell>
                    <TableCell className="space-x-1">
                      <Button variant="ghost" size="sm" onClick={() => startEdit(a)}>
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm('Delete this asset?')) deleteMutation.mutate(a.id);
                        }}
                      >
                        Delete
                      </Button>
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
