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
import { AlertTriangle, Loader2, Building2, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { useCurrency } from '@/hooks/use-currency';
import { toast } from 'sonner';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { FullTableSkeleton } from '@/components/loading';
import { confirmAction } from '@/lib/confirm-action';

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

function formatDate(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : format(d, 'd MMM yyyy');
}

function toDateInput(value?: string | null) {
  if (!value) return '';
  return value.slice(0, 10);
}

export default function AssetsPage() {
  const { slug, path, workspaceFetch } = useWorkspacePaths();
  const queryClient = useQueryClient();
  const { currency, formatCurrency } = useCurrency();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [value, setValue] = useState('');
  const [depreciation, setDepreciation] = useState('0');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [equipmentInstallationId, setEquipmentInstallationId] = useState('');
  const [editing, setEditing] = useState<Asset | null>(null);

  const { data: assets = [], isLoading, isError, refetch } = useQuery({
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

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (a: Asset) => {
    setEditing(a);
    setName(a.name);
    setType(a.type);
    setValue(String(a.value));
    setDepreciation(String(a.depreciation ?? 0));
    setPurchaseDate(toDateInput(a.purchaseDate));
    setEquipmentInstallationId(
      a.equipmentInstallationId || a.equipmentInstallation?.id || ''
    );
    setDialogOpen(true);
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
      setDialogOpen(false);
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
      queryClient.invalidateQueries({ queryKey: ['assets', slug] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const confirmDeleteAsset = async ({ id, name: assetName }: Asset) => {
    if (
      !(await confirmAction({
        title: `Delete “${assetName}”?`,
        description: 'This cannot be undone.',
        confirmLabel: 'Delete',
        variant: 'destructive',
      }))
    )
      return;
    deleteMutation.mutate(id);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Assets</h1>
          <p className="text-sm text-muted-foreground">
            Internal fixed-asset register. Installed customer equipment lives on{' '}
            <Link href={path('/dashboard/equipment')} className="text-primary underline">
              Fleet
            </Link>
            .
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            New asset
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          {isLoading ? (
            <FullTableSkeleton columnCount={5} rowCount={5} />
          ) : isError ? (
            <EmptyState
              icon={AlertTriangle}
              title="Couldn't load assets"
              description="Check your connection and try again."
              actionLabel="Try again"
              onAction={() => refetch()}
            />
          ) : assets.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="No assets yet"
              description="Record vehicles, tools, IT hardware, and other company-owned assets to track their value and depreciation."
              actionLabel="New asset"
              onAction={openCreate}
            />
          ) : (
            <>
            <div className="divide-y rounded-md border md:hidden">
              {assets.map((a) => (
                <div key={a.id} className="flex items-start justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{a.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {a.type} · {formatDate(a.purchaseDate)}
                    </p>
                    <p className="truncate text-xs text-muted-foreground tabular-nums">
                      Value {formatCurrency(a.value)} · Depreciation {formatCurrency(a.depreciation)}
                    </p>
                    {a.equipmentInstallation ? (
                      <p className="truncate text-xs text-muted-foreground">
                        {[
                          a.equipmentInstallation.product?.name,
                          a.equipmentInstallation.serialNumber,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="sm" className="h-10" onClick={() => openEdit(a)}>
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-10"
                      onClick={() => confirmDeleteAsset(a)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden rounded-md border overflow-x-auto md:block">
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
                      <TableCell className="text-right tabular-nums">{formatCurrency(a.value)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(a.depreciation)}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(a.purchaseDate)}</TableCell>
                      <TableCell className="space-x-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(a)}>
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => confirmDeleteAsset(a)}
                        >
                          Delete
                        </Button>
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit asset' : 'New asset'}</DialogTitle>
            <DialogDescription>
              {editing
                ? 'Update this fixed asset in the register.'
                : 'Add a company fixed asset to the register.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="asset-name">Name</Label>
              <Input id="asset-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="asset-type">Type</Label>
              <Input id="asset-type" value={type} onChange={(e) => setType(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="asset-value">Value ({currency})</Label>
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
              <Label htmlFor="asset-dep">Depreciation ({currency})</Label>
              <Input
                id="asset-dep"
                type="number"
                min={0}
                step="0.01"
                value={depreciation}
                onChange={(e) => setDepreciation(e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="asset-date">Purchase date</Label>
              <Input
                id="asset-date"
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="asset-fleet">Linked fleet unit (optional)</Label>
              <select
                id="asset-fleet"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
              disabled={!name.trim() || !type.trim() || !value || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? 'Save changes' : 'Create asset'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
