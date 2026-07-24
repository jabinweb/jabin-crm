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
import { Loader2, Plus, ShoppingCart, Trash2, LayoutGrid, List } from 'lucide-react';
import { toast } from 'sonner';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { PipelineBoard, buildBoardState } from '@/components/pipelines/pipeline-board';
import { usePipelineColumns } from '@/hooks/use-pipeline-columns';

type ProductOption = { id: string; name: string; price: number; sku?: string };

type LineItemDraft = {
  key: string;
  productId: string;
  quantity: string;
  unitPrice: string;
};

type SalesOrder = {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  lineItems?: Array<{ productId: string; quantity: number; unitPrice: number; name?: string }>;
};

type SoReport = {
  count: number;
  openCount: number;
  totalRevenue: number;
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

export default function SalesOrdersPage() {
  const { slug, workspaceFetch } = useWorkspacePaths();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const reportFromUrl = searchParams.get('report') === '1';

  const [status, setStatus] = useState('PENDING');
  const [lineItems, setLineItems] = useState<LineItemDraft[]>([emptyLine()]);
  const [showReport, setShowReport] = useState(reportFromUrl);
  const [view, setView] = useState<'list' | 'board'>('list');
  const [optimistic, setOptimistic] = useState<Record<string, string>>({});
  const { columns: baseColumns, loading: columnsLoading } = usePipelineColumns('sales_orders');

  const reportEnabled = showReport;

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
    queryKey: ['sales-orders', slug, reportEnabled],
    queryFn: async () => {
      const res = await workspaceFetch(
        reportEnabled ? '/api/sales-orders?report=1' : '/api/sales-orders'
      );
      if (!res.ok) throw new Error('Failed to load sales orders');
      const json = await res.json();
      if (reportEnabled && json && !Array.isArray(json)) {
        return {
          orders: (json.orders ?? []) as SalesOrder[],
          report: json.report as SoReport,
        };
      }
      return { orders: json as SalesOrder[], report: null as SoReport | null };
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
      const res = await workspaceFetch(`/api/sales-orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: toStage }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update SO');
      }
      setOptimistic((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      await queryClient.invalidateQueries({ queryKey: ['sales-orders', slug] });
    } catch (error) {
      setOptimistic((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      toast.error(error instanceof Error ? error.message : 'Move failed');
      await queryClient.invalidateQueries({ queryKey: ['sales-orders', slug] });
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
      const res = await workspaceFetch('/api/sales-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
      toast.success('Sales order created');
      setStatus('PENDING');
      setLineItems([emptyLine()]);
      queryClient.invalidateQueries({ queryKey: ['sales-orders', slug] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canCreate = validLines.length > 0 && !createMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sales orders</h1>
          <p className="text-sm text-muted-foreground">Track outbound sales orders with line items.</p>
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
            <Switch id="so-report" checked={reportEnabled} onCheckedChange={setShowReport} />
            <Label htmlFor="so-report" className="text-sm font-normal cursor-pointer">
              Show report summary
            </Label>
          </div>
        </div>
      </div>

      {reportEnabled && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total SOs</CardTitle>
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
              <CardTitle className="text-sm font-medium text-muted-foreground">Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">
                {isLoading ? '—' : (report?.totalRevenue ?? 0).toLocaleString()}
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
          <CardTitle className="text-base">New sales order</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 max-w-xs">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'].map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                    const lineTotal = q > 0 && !Number.isNaN(p) && p >= 0 ? q * p : 0;
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
            Create SO
          </Button>
        </CardContent>
      </Card>

      {view === 'board' ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">SO pipeline</CardTitle>
            <CardDescription>Drag sales orders between stages.</CardDescription>
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
                    <p className="text-sm font-semibold">{o.orderNumber}</p>
                    <p className="text-xs tabular-nums">{o.totalAmount.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">
                      {Array.isArray(o.lineItems) ? `${o.lineItems.length} lines` : '—'}
                    </p>
                  </div>
                )}
              />
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">All sales orders</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : orders.length === 0 ? (
              <EmptyState
                icon={ShoppingCart}
                title="No sales orders"
                description="Create a sales order above."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Lines</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-medium">{o.orderNumber}</TableCell>
                      <TableCell>{o.status}</TableCell>
                      <TableCell className="text-right">{o.totalAmount.toLocaleString()}</TableCell>
                      <TableCell>
                        {Array.isArray(o.lineItems) ? o.lineItems.length : '—'}
                      </TableCell>
                      <TableCell>{new Date(o.createdAt).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
