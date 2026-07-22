'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Loader2, ClipboardList } from 'lucide-react';
import { toast } from 'sonner';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';

type SupplierOption = { id: string; name: string };

type PurchaseOrder = {
  id: string;
  poNumber: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  supplier: { id: string; name: string; email: string };
};

export default function PurchaseOrdersPage() {
  const { slug, workspaceFetch } = useWorkspacePaths();
  const queryClient = useQueryClient();
  const [supplierId, setSupplierId] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [status, setStatus] = useState('DRAFT');

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers', slug],
    queryFn: async () => {
      const res = await workspaceFetch('/api/suppliers');
      if (!res.ok) throw new Error('Failed to load suppliers');
      return (await res.json()) as SupplierOption[];
    },
    enabled: !!slug,
  });

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['purchase-orders', slug],
    queryFn: async () => {
      const res = await workspaceFetch('/api/purchase-orders');
      if (!res.ok) throw new Error('Failed to load purchase orders');
      return (await res.json()) as PurchaseOrder[];
    },
    enabled: !!slug,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await workspaceFetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId,
          totalAmount: Number(totalAmount),
          status,
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
      setTotalAmount('');
      setStatus('DRAFT');
      queryClient.invalidateQueries({ queryKey: ['purchase-orders', slug] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Purchase orders</h1>
        <p className="text-sm text-muted-foreground">Create and track POs with suppliers.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">New purchase order</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
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
            <Label htmlFor="po-amount">Total amount</Label>
            <Input
              id="po-amount"
              type="number"
              min={0}
              step="0.01"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
            />
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
          <div className="sm:col-span-3">
            <Button
              disabled={!supplierId || !totalAmount || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create PO
            </Button>
          </div>
        </CardContent>
      </Card>

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
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">{o.poNumber}</TableCell>
                    <TableCell>{o.supplier?.name}</TableCell>
                    <TableCell>{o.status}</TableCell>
                    <TableCell className="text-right">{o.totalAmount.toLocaleString()}</TableCell>
                    <TableCell>{new Date(o.createdAt).toLocaleDateString()}</TableCell>
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
