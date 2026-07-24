'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
import { Loader2, ClipboardList, Plus, Trash2, LayoutGrid, List } from 'lucide-react';
import { toast } from 'sonner';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { PipelineBoard, buildBoardState } from '@/components/pipelines/pipeline-board';
import { usePipelineColumns } from '@/hooks/use-pipeline-columns';

type SupplierOption = { id: string; name: string };
type ProductOption = { id: string; name: string; price: number; sku?: string };

type LineItemDraft = {
  key: string;
  productId: string;
  quantity: string;
  unitPrice: string;
};

type PurchaseOrder = {
  id: string;
  poNumber: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  supplier: { id: string; name: string; email: string };
  lineItems?: Array<{ productId: string; quantity: number; unitPrice: number; name?: string }>;
};

type PoReport = {
  count: number;
  openCount: number;
  totalSpend: number;
  byStatus: Record<string, number>;
};

function emptyLine(): LineItemDraft {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    productId: '',
    quantity: '1',
    unitPrice: '',
  };
}

export default function PurchaseOrdersPage() {
  const { slug, workspaceFetch } = useWorkspacePaths();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const reportFromUrl = searchParams.get('report') === '1';

  const [supplierId, setSupplierId] = useState('');
  const [status, setStatus] = useState('DRAFT');
  const [lineItems, setLineItems] = useState<LineItemDraft[]>([emptyLine()]);
  const [showReport, setShowReport] = useState(reportFromUrl);
  const [actionId, setActionId] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'board'>('list');
  const [optimistic, setOptimistic] = useState<Record<string, string>>({});
  const { columns: baseColumns, loading: columnsLoading } = usePipelineColumns('purchase_orders');

  const reportEnabled = showReport;

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers', slug],
    queryFn: async () => {
      const res = await workspaceFetch('/api/suppliers');
      if (!res.ok) throw new Error('Failed to load suppliers');
      return (await res.json()) as SupplierOption[];
    },
    enabled: !!slug,
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products', slug],
    queryFn: async () => {
      const res = await workspaceFetch('/api/products');
      if (!res.ok) throw new Error('Failed to load products');
      return (await res.json()) as ProductOption[];
    },
    enabled: !!slug,
  });

  const { data: listData, isLoading } = useQuery({
    queryKey: ['purchase-orders', slug, reportEnabled],
    queryFn: async () => {
      const res = await workspaceFetch(
        reportEnabled ? '/api/purchase-orders?report=1' : '/api/purchase-orders'
      );
      if (!res.ok) throw new Error('Failed to load purchase orders');
      const json = await res.json();
      if (reportEnabled && json && !Array.isArray(json)) {
        return {
          orders: (json.orders ?? []) as PurchaseOrder[],
          report: json.report as PoReport,
        };
      }
      return { orders: json as PurchaseOrder[], report: null as PoReport | null };
    },
    enabled: !!slug,
  });

  const orders = listData?.orders ?? [];
  const report = listData?.report ?? null;

  const boardItems = useMemo(
    () =>
      orders.map((o) => {
        const stage = optimistic[o.id] ?? o.status;
        return { ...o, status: stage, stage };
      }),
    [orders, optimistic]
  );
  const { columns, itemsByStage } = useMemo(
    () => buildBoardState(boardItems, baseColumns),
    [boardItems, baseColumns]
  );

  const onBoardMove = async (id: string, toStage: string, fromStage: string) => {
    if (toStage === fromStage) return;
    setOptimistic((prev) => ({ ...prev, [id]: toStage }));
    try {
      const res = await workspaceFetch(`/api/purchase-orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: toStage }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update PO');
      }
      setOptimistic((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      await queryClient.invalidateQueries({ queryKey: ['purchase-orders', slug] });
    } catch (error) {
      setOptimistic((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      toast.error(error instanceof Error ? error.message : 'Move failed');
      await queryClient.invalidateQueries({ queryKey: ['purchase-orders', slug] });
    }
  };

  const computedTotal = useMemo(() => {
    return lineItems.reduce((sum, row) => {
      const q = Number(row.quantity);
      const p = Number(row.unitPrice);
      if (!(q > 0) || Number.isNaN(p) || p < 0) return sum;
      return sum + q * p;
    }, 0);
  }, [lineItems]);

  const validLines = useMemo(() => {
    return lineItems
      .map((row) => {
        const quantity = Number(row.quantity);
        const unitPrice = Number(row.unitPrice);
        if (!row.productId || !(quantity > 0) || Number.isNaN(unitPrice) || unitPrice < 0) {
          return null;
        }
        const product = products.find((p) => p.id === row.productId);
        return {
          productId: row.productId,
          name: product?.name,
          quantity,
          unitPrice,
        };
      })
      .filter(Boolean) as Array<{
      productId: string;
      name?: string;
      quantity: number;
      unitPrice: number;
    }>;
  }, [lineItems, products]);

  const updateLine = (key: string, patch: Partial<LineItemDraft>) => {
    setLineItems((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await workspaceFetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId,
          status,
          lineItems: validLines,
          totalAmount: computedTotal,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Purchase order created');
      setSupplierId('');
      setStatus('DRAFT');
      setLineItems([emptyLine()]);
      queryClient.invalidateQueries({ queryKey: ['purchase-orders', slug] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const actionMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'approve' | 'receive' | 'cancel' }) => {
      setActionId(id);
      const res = await workspaceFetch(`/api/purchase-orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed to ${action}`);
      }
      return res.json();
    },
    onSuccess: (_data, vars) => {
      const labels = { approve: 'approved', receive: 'received', cancel: 'cancelled' } as const;
      toast.success(`Purchase order ${labels[vars.action]}`);
      queryClient.invalidateQueries({ queryKey: ['purchase-orders', slug] });
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setActionId(null),
  });

  const canCreate = !!supplierId && validLines.length > 0 && !createMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Purchase orders</h1>
          <p className="text-sm text-muted-foreground">Create and track POs with suppliers.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={view === 'list' ? 'default' : 'outline'}
              onClick={() => setView('list')}
            >
              <List className="mr-1.5 h-4 w-4" />
              List
            </Button>
            <Button
              size="sm"
              variant={view === 'board' ? 'default' : 'outline'}
              onClick={() => setView('board')}
            >
              <LayoutGrid className="mr-1.5 h-4 w-4" />
              Board
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="po-report"
              checked={reportEnabled}
              onCheckedChange={setShowReport}
            />
            <Label htmlFor="po-report" className="text-sm font-normal cursor-pointer">
              Show report summary
            </Label>
          </div>
        </div>
      </div>

      {reportEnabled && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total POs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">
                {isLoading ? '—' : (report?.count ?? 0).toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Open</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">
                {isLoading ? '—' : (report?.openCount ?? 0).toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total spend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">
                {isLoading ? '—' : (report?.totalSpend ?? 0).toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">By status</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading || !report?.byStatus ? (
                <div className="text-2xl font-semibold">—</div>
              ) : (
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
                  {Object.entries(report.byStatus).map(([s, n]) => (
                    <span key={s}>
                      <span className="text-muted-foreground">{s}:</span> {n}
                    </span>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">New purchase order</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Supplier</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['DRAFT', 'SENT', 'RECEIVED', 'CANCELLED'].map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Line items</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setLineItems((prev) => [...prev, emptyLine()])}
              >
                <Plus className="mr-1 h-4 w-4" />
                Add row
              </Button>
            </div>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="w-28">Qty</TableHead>
                    <TableHead className="w-36">Unit price</TableHead>
                    <TableHead className="w-28 text-right">Line total</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineItems.map((row) => {
                    const q = Number(row.quantity);
                    const p = Number(row.unitPrice);
                    const lineTotal =
                      q > 0 && !Number.isNaN(p) && p >= 0 ? q * p : 0;
                    return (
                      <TableRow key={row.key}>
                        <TableCell>
                          <Select
                            value={row.productId}
                            onValueChange={(productId) => {
                              const product = products.find((p) => p.id === productId);
                              updateLine(row.key, {
                                productId,
                                unitPrice: product ? String(product.price ?? 0) : row.unitPrice,
                              });
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select product" />
                            </SelectTrigger>
                            <SelectContent>
                              {products.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.name}
                                  {p.sku ? ` (${p.sku})` : ''}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={1}
                            step={1}
                            value={row.quantity}
                            onChange={(e) => updateLine(row.key, { quantity: e.target.value })}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={row.unitPrice}
                            onChange={(e) => updateLine(row.key, { unitPrice: e.target.value })}
                          />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {lineTotal.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={lineItems.length <= 1}
                            onClick={() =>
                              setLineItems((prev) => prev.filter((r) => r.key !== row.key))
                            }
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="flex justify-end text-sm">
              <span className="text-muted-foreground mr-2">Total</span>
              <span className="font-medium tabular-nums">{computedTotal.toLocaleString()}</span>
            </div>
          </div>

          <Button disabled={!canCreate} onClick={() => createMutation.mutate()}>
            {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create PO
          </Button>
        </CardContent>
      </Card>

      {view === 'board' ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">PO pipeline</CardTitle>
            <CardDescription>Drag orders between stages. Receiving still updates stock.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading || columnsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <PipelineBoard
                columns={columns}
                itemsByStage={itemsByStage}
                onMove={onBoardMove}
                renderCard={(o) => (
                  <div className="p-3 space-y-1">
                    <p className="text-sm font-semibold">{o.poNumber}</p>
                    <p className="text-xs text-muted-foreground">{o.supplier?.name}</p>
                    <p className="text-xs tabular-nums">{o.totalAmount.toLocaleString()}</p>
                  </div>
                )}
              />
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">All purchase orders</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : orders.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title="No purchase orders"
                description="Create a PO above."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PO #</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((o) => {
                    const busy = actionMutation.isPending && actionId === o.id;
                    const canApprove = o.status === 'DRAFT';
                    const canReceive = o.status === 'DRAFT' || o.status === 'SENT';
                    const canCancel = o.status !== 'CANCELLED' && o.status !== 'RECEIVED';
                    return (
                      <TableRow key={o.id}>
                        <TableCell className="font-medium">{o.poNumber}</TableCell>
                        <TableCell>{o.supplier?.name}</TableCell>
                        <TableCell>{o.status}</TableCell>
                        <TableCell className="text-right">{o.totalAmount.toLocaleString()}</TableCell>
                        <TableCell>{new Date(o.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap justify-end gap-1">
                            {canApprove && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                onClick={() =>
                                  actionMutation.mutate({ id: o.id, action: 'approve' })
                                }
                              >
                                Approve
                              </Button>
                            )}
                            {canReceive && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                onClick={() =>
                                  actionMutation.mutate({ id: o.id, action: 'receive' })
                                }
                              >
                                Receive
                              </Button>
                            )}
                            {canCancel && (
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={busy}
                                onClick={() =>
                                  actionMutation.mutate({ id: o.id, action: 'cancel' })
                                }
                              >
                                Cancel
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
