'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
  ArrowLeftRight,
  Loader2,
  Package,
  Plus,
  Search,
  Truck,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { FeatureModuleGuard } from '@/components/feature-module-guard';
import { CardListSkeleton } from '@/components/loading';
import { confirmAction } from '@/lib/confirm-action';
import { cn } from '@/lib/utils';

type DemoUnit = {
  id: string;
  name: string;
  kind: string;
  status: string;
  serialNumber?: string | null;
  assetTag?: string | null;
  notes?: string | null;
  expectedReturnAt?: string | null;
  product?: { id: string; name: string; sku?: string | null } | null;
  currentLocation?: { id: string; name: string; code?: string } | null;
  currentCustomer?: { id: string; organizationName: string } | null;
  custodian?: { id: string; name?: string | null } | null;
  updatedAt: string;
  movements?: Array<{
    id: string;
    type: string;
    movedAt: string;
    purpose?: string | null;
    notes?: string | null;
    fromLocation?: { name: string } | null;
    toLocation?: { name: string } | null;
    fromCustomer?: { organizationName: string } | null;
    toCustomer?: { organizationName: string } | null;
  }>;
};

const KINDS = [
  { value: 'DEMO_MACHINE', label: 'Demo machine' },
  { value: 'EQUIPMENT', label: 'Equipment' },
  { value: 'INSTRUMENT', label: 'Instrument' },
] as const;

const STATUSES = [
  'IN_STOCK',
  'ON_DEMO',
  'AT_CUSTOMER',
  'IN_TRANSIT',
  'MAINTENANCE',
  'RETIRED',
] as const;

const MOVE_TYPES = [
  { value: 'CHECKOUT', label: 'Checkout (demo)' },
  { value: 'TRANSFER', label: 'Transfer' },
  { value: 'RETURN', label: 'Return to stock' },
  { value: 'RELOCATE', label: 'Relocate' },
  { value: 'MAINTENANCE', label: 'Send to maintenance' },
  { value: 'RETIRE', label: 'Retire' },
] as const;

function statusVariant(status: string) {
  if (status === 'IN_STOCK') return 'secondary' as const;
  if (status === 'ON_DEMO' || status === 'AT_CUSTOMER') return 'default' as const;
  if (status === 'MAINTENANCE' || status === 'IN_TRANSIT') return 'outline' as const;
  return 'destructive' as const;
}

function DemoEquipmentPageInner() {
  const { path, workspaceFetch } = useWorkspacePaths();
  const queryClient = useQueryClient();
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [kindFilter, setKindFilter] = useState('ALL');
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    kind: 'DEMO_MACHINE',
    serialNumber: '',
    assetTag: '',
    productId: '',
    currentLocationId: '',
    notes: '',
  });

  const [editForm, setEditForm] = useState({
    name: '',
    kind: 'DEMO_MACHINE',
    status: 'IN_STOCK',
    serialNumber: '',
    assetTag: '',
    productId: '',
    currentLocationId: '',
    notes: '',
  });

  const [moveForm, setMoveForm] = useState({
    type: 'CHECKOUT',
    toLocationId: '',
    toCustomerId: '',
    purpose: '',
    notes: '',
    expectedReturnAt: '',
  });

  const listParams = useMemo(() => {
    const p = new URLSearchParams();
    if (q.trim()) p.set('q', q.trim());
    if (statusFilter !== 'ALL') p.set('status', statusFilter);
    if (kindFilter !== 'ALL') p.set('kind', kindFilter);
    return p.toString();
  }, [q, statusFilter, kindFilter]);

  const { data, isLoading } = useQuery({
    queryKey: ['demo-equipment', listParams],
    queryFn: async () => {
      const res = await workspaceFetch(`/api/demo-equipment?${listParams}`);
      if (!res.ok) throw new Error('Failed to load units');
      return (await res.json()) as { units: DemoUnit[] };
    },
  });

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ['demo-equipment', selectedId],
    enabled: !!selectedId && (detailOpen || moveOpen || editOpen),
    queryFn: async () => {
      const res = await workspaceFetch(`/api/demo-equipment/${selectedId}`);
      if (!res.ok) throw new Error('Failed to load unit');
      return (await res.json()) as DemoUnit;
    },
  });

  const { data: locations = [] } = useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      const res = await workspaceFetch('/api/locations');
      if (!res.ok) return [];
      const body = await res.json();
      return (Array.isArray(body) ? body : body.data || []) as Array<{
        id: string;
        name: string;
      }>;
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products-lite'],
    queryFn: async () => {
      const res = await workspaceFetch('/api/products');
      if (!res.ok) return [];
      const body = await res.json();
      return (Array.isArray(body) ? body : body.data || []) as Array<{
        id: string;
        name: string;
        sku?: string | null;
      }>;
    },
  });

  const { data: customersData } = useQuery({
    queryKey: ['customers-lite'],
    queryFn: async () => {
      const res = await workspaceFetch('/api/customers?limit=100');
      if (!res.ok) return { customers: [] };
      return res.json() as Promise<{
        customers: Array<{ id: string; organizationName: string }>;
      }>;
    },
  });
  const customers = customersData?.customers || [];

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await workspaceFetch('/api/demo-equipment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          kind: form.kind,
          serialNumber: form.serialNumber || null,
          assetTag: form.assetTag || null,
          productId: form.productId || null,
          currentLocationId: form.currentLocationId || null,
          notes: form.notes || null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Failed to create');
      return body;
    },
    onSuccess: () => {
      toast.success('Unit registered');
      setCreateOpen(false);
      setForm({
        name: '',
        kind: 'DEMO_MACHINE',
        serialNumber: '',
        assetTag: '',
        productId: '',
        currentLocationId: '',
        notes: '',
      });
      queryClient.invalidateQueries({ queryKey: ['demo-equipment'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const editMutation = useMutation({
    mutationFn: async () => {
      if (!selectedId) return;
      const res = await workspaceFetch(`/api/demo-equipment/${selectedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name,
          kind: editForm.kind,
          status: editForm.status,
          serialNumber: editForm.serialNumber || null,
          assetTag: editForm.assetTag || null,
          productId: editForm.productId || null,
          currentLocationId: editForm.currentLocationId || null,
          notes: editForm.notes || null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Failed to update');
      return body;
    },
    onSuccess: () => {
      toast.success('Unit updated');
      setEditOpen(false);
      queryClient.invalidateQueries({ queryKey: ['demo-equipment'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await workspaceFetch(`/api/demo-equipment/${id}`, { method: 'DELETE' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Failed to delete');
      return body;
    },
    onSuccess: () => {
      toast.success('Unit deleted');
      setDetailOpen(false);
      setEditOpen(false);
      setMoveOpen(false);
      setSelectedId(null);
      queryClient.invalidateQueries({ queryKey: ['demo-equipment'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openEdit = (u: DemoUnit) => {
    setSelectedId(u.id);
    setEditForm({
      name: u.name,
      kind: u.kind,
      status: u.status,
      serialNumber: u.serialNumber || '',
      assetTag: u.assetTag || '',
      productId: u.product?.id || '',
      currentLocationId: u.currentLocation?.id || '',
      notes: u.notes || '',
    });
    setEditOpen(true);
  };

  const moveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedId) return;
      const res = await workspaceFetch(`/api/demo-equipment/${selectedId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: moveForm.type,
          toLocationId: moveForm.toLocationId || null,
          toCustomerId:
            moveForm.type === 'RETURN' ? null : moveForm.toCustomerId || null,
          purpose: moveForm.purpose || null,
          notes: moveForm.notes || null,
          expectedReturnAt: moveForm.expectedReturnAt || null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Move failed');
      return body;
    },
    onSuccess: () => {
      toast.success('Movement recorded');
      setMoveOpen(false);
      setMoveForm({
        type: 'CHECKOUT',
        toLocationId: '',
        toCustomerId: '',
        purpose: '',
        notes: '',
        expectedReturnAt: '',
      });
      queryClient.invalidateQueries({ queryKey: ['demo-equipment'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const units = data?.units || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link href={path('/dashboard/inventory')} className="hover:underline">
              Equipment stock
            </Link>
            <span>/</span>
            <span>Demo & instruments</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Demo machines & instruments
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track serialized units: checkout for demos, transfer between sites, return to stock.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button variant="outline" asChild>
            <Link href={path('/dashboard/inventory/locations')}>Locations</Link>
          </Button>
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Register unit
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, serial, asset tag…"
            className="pl-8"
          />
        </div>
        <Select value={kindFilter} onValueChange={setKindFilter}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Kind" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All kinds</SelectItem>
            {KINDS.map((k) => (
              <SelectItem key={k.value} value={k.value}>
                {k.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s.replace(/_/g, ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Fleet</CardTitle>
          <CardDescription>
            {units.length} unit{units.length === 1 ? '' : 's'}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4">
              <CardListSkeleton rows={5} />
            </div>
          ) : units.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
              <Package className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm font-medium">No units yet</p>
              <p className="text-xs text-muted-foreground max-w-sm">
                Register a demo machine or instrument to start tracking custody and movement.
              </p>
              <Button size="sm" className="mt-2" onClick={() => setCreateOpen(true)}>
                Register unit
              </Button>
            </div>
          ) : (
            <ul className="divide-y">
              {units.map((u) => (
                <li
                  key={u.id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => {
                      setSelectedId(u.id);
                      setDetailOpen(true);
                    }}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium truncate">{u.name}</p>
                      <Badge variant="outline" className="text-[10px]">
                        {KINDS.find((k) => k.value === u.kind)?.label || u.kind}
                      </Badge>
                      <Badge variant={statusVariant(u.status)} className="text-[10px]">
                        {u.status.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground truncate">
                      {[
                        u.serialNumber ? `S/N ${u.serialNumber}` : null,
                        u.assetTag ? `Tag ${u.assetTag}` : null,
                        u.currentLocation?.name,
                        u.currentCustomer?.organizationName,
                        u.product?.name,
                      ]
                        .filter(Boolean)
                        .join(' · ') || 'No location yet'}
                    </p>
                  </button>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => {
                        setSelectedId(u.id);
                        setMoveForm((f) => ({
                          ...f,
                          toLocationId: u.currentLocation?.id || '',
                          toCustomerId: u.currentCustomer?.id || '',
                        }));
                        setMoveOpen(true);
                      }}
                    >
                      <Truck className="h-3.5 w-3.5" />
                      Move
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => openEdit(u)}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        const ok = await confirmAction({
                          title: `Delete ${u.name}?`,
                          confirmLabel: 'Delete',
                          variant: 'destructive',
                        });
                        if (ok) deleteMutation.mutate(u.id);
                      }}
                    >
                      Delete
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setSelectedId(u.id);
                        setDetailOpen(true);
                      }}
                    >
                      History
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Create */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Register unit</DialogTitle>
            <DialogDescription>
              Add a demo machine, equipment piece, or instrument to the fleet.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ventilator demo #3"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Kind</Label>
              <Select
                value={form.kind}
                onValueChange={(v) => setForm({ ...form, kind: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KINDS.map((k) => (
                    <SelectItem key={k.value} value={k.value}>
                      {k.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Serial number</Label>
                <Input
                  value={form.serialNumber}
                  onChange={(e) => setForm({ ...form, serialNumber: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Asset tag</Label>
                <Input
                  value={form.assetTag}
                  onChange={(e) => setForm({ ...form, assetTag: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Catalog product (optional)</Label>
              <Select
                value={form.productId || '__none__'}
                onValueChange={(v) =>
                  setForm({ ...form, productId: v === '__none__' ? '' : v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Link product" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                      {p.sku ? ` (${p.sku})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Home location</Label>
              <Select
                value={form.currentLocationId || '__none__'}
                onValueChange={(v) =>
                  setForm({ ...form, currentLocationId: v === '__none__' ? '' : v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Warehouse / store" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Unassigned</SelectItem>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Notes</Label>
              <Textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!form.name.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Register
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit unit</DialogTitle>
            <DialogDescription>
              Update unit details. Use Move to change custody or location with a log entry.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label>Name *</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Kind</Label>
                <Select
                  value={editForm.kind}
                  onValueChange={(v) => setEditForm({ ...editForm, kind: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {KINDS.map((k) => (
                      <SelectItem key={k.value} value={k.value}>
                        {k.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Status</Label>
                <Select
                  value={editForm.status}
                  onValueChange={(v) => setEditForm({ ...editForm, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s.replace(/_/g, ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Serial number</Label>
                <Input
                  value={editForm.serialNumber}
                  onChange={(e) => setEditForm({ ...editForm, serialNumber: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Asset tag</Label>
                <Input
                  value={editForm.assetTag}
                  onChange={(e) => setEditForm({ ...editForm, assetTag: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Catalog product</Label>
              <Select
                value={editForm.productId || '__none__'}
                onValueChange={(v) =>
                  setEditForm({ ...editForm, productId: v === '__none__' ? '' : v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Link product" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                      {p.sku ? ` (${p.sku})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Location</Label>
              <Select
                value={editForm.currentLocationId || '__none__'}
                onValueChange={(v) =>
                  setEditForm({
                    ...editForm,
                    currentLocationId: v === '__none__' ? '' : v,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Warehouse / store" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Unassigned</SelectItem>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Notes</Label>
              <Textarea
                rows={2}
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="destructive"
              className="mr-auto"
              disabled={!selectedId || deleteMutation.isPending}
              onClick={async () => {
                if (!selectedId) return;
                const ok = await confirmAction({
                  title: 'Delete this unit?',
                  confirmLabel: 'Delete',
                  variant: 'destructive',
                });
                if (ok) {
                  deleteMutation.mutate(selectedId);
                }
              }}
            >
              Delete
            </Button>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!editForm.name.trim() || editMutation.isPending}
              onClick={() => editMutation.mutate()}
            >
              {editMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move */}
      <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowLeftRight className="h-4 w-4" />
              Record movement
            </DialogTitle>
            <DialogDescription>
              {detail?.name || 'Selected unit'} — updates custody and writes a movement log.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label>Movement type</Label>
              <Select
                value={moveForm.type}
                onValueChange={(v) => setMoveForm({ ...moveForm, type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MOVE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>To location</Label>
              <Select
                value={moveForm.toLocationId || '__none__'}
                onValueChange={(v) =>
                  setMoveForm({
                    ...moveForm,
                    toLocationId: v === '__none__' ? '' : v,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Clear / none</SelectItem>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {moveForm.type !== 'RETURN' && moveForm.type !== 'RETIRE' ? (
              <div className="grid gap-1.5">
                <Label>To customer (demo / site)</Label>
                <Select
                  value={moveForm.toCustomerId || '__none__'}
                  onValueChange={(v) =>
                    setMoveForm({
                      ...moveForm,
                      toCustomerId: v === '__none__' ? '' : v,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Customer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.organizationName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            {(moveForm.type === 'CHECKOUT' || moveForm.type === 'TRANSFER') && (
              <div className="grid gap-1.5">
                <Label>Expected return</Label>
                <Input
                  type="date"
                  value={moveForm.expectedReturnAt}
                  onChange={(e) =>
                    setMoveForm({ ...moveForm, expectedReturnAt: e.target.value })
                  }
                />
              </div>
            )}
            <div className="grid gap-1.5">
              <Label>Purpose</Label>
              <Input
                value={moveForm.purpose}
                onChange={(e) => setMoveForm({ ...moveForm, purpose: e.target.value })}
                placeholder="Demo visit, calibration, loan…"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Notes</Label>
              <Textarea
                rows={2}
                value={moveForm.notes}
                onChange={(e) => setMoveForm({ ...moveForm, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={moveMutation.isPending}
              onClick={() => moveMutation.mutate()}
            >
              {moveMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save movement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History / detail */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{detail?.name || 'Unit'}</DialogTitle>
            <DialogDescription>Current custody and movement history</DialogDescription>
          </DialogHeader>
          {detailLoading && !detail ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : detail ? (
            <div className="space-y-3 min-h-0 flex-1">
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline">
                  {KINDS.find((k) => k.value === detail.kind)?.label || detail.kind}
                </Badge>
                <Badge variant={statusVariant(detail.status)}>
                  {detail.status.replace(/_/g, ' ')}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {[
                  detail.serialNumber ? `S/N ${detail.serialNumber}` : null,
                  detail.currentLocation?.name,
                  detail.currentCustomer?.organizationName,
                  detail.custodian?.name,
                ]
                  .filter(Boolean)
                  .join(' · ') || '—'}
              </p>
              {detail.expectedReturnAt ? (
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Expected return{' '}
                  {new Date(detail.expectedReturnAt).toLocaleDateString()}
                </p>
              ) : null}
              <ScrollArea className="h-64 rounded-md border">
                {(detail.movements || []).length === 0 ? (
                  <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                    No movements yet
                  </p>
                ) : (
                  <ul className="divide-y">
                    {detail.movements!.map((m) => (
                      <li key={m.id} className="px-3 py-2.5 space-y-0.5">
                        <div className="flex items-center justify-between gap-2">
                          <Badge
                            variant="outline"
                            className={cn('text-[10px] font-normal')}
                          >
                            {m.type}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {formatDistanceToNow(new Date(m.movedAt), {
                              addSuffix: true,
                            })}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {[
                            m.fromLocation?.name || m.fromCustomer?.organizationName,
                            '→',
                            m.toLocation?.name ||
                              m.toCustomer?.organizationName ||
                              '—',
                          ].join(' ')}
                        </p>
                        {m.purpose ? (
                          <p className="text-xs">{m.purpose}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </ScrollArea>
            </div>
          ) : null}
          <DialogFooter className="gap-2 flex-wrap">
            <Button
              variant="outline"
              onClick={() => {
                if (detail) openEdit(detail);
                setDetailOpen(false);
              }}
            >
              Edit
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setDetailOpen(false);
                setMoveOpen(true);
              }}
            >
              Record move
            </Button>
            <Button
              variant="ghost"
              onClick={async () => {
                if (!selectedId) return;
                const ok = await confirmAction({
                  title: 'Delete this unit?',
                  confirmLabel: 'Delete',
                  variant: 'destructive',
                });
                if (ok) {
                  deleteMutation.mutate(selectedId);
                }
              }}
            >
              Delete
            </Button>
            <Button onClick={() => setDetailOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function DemoEquipmentPage() {
  return (
    <FeatureModuleGuard module="EQUIPMENT">
      <DemoEquipmentPageInner />
    </FeatureModuleGuard>
  );
}
