'use client';

import { useState } from 'react';
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
};

export default function AssetsPage() {
  const { slug, workspaceFetch } = useWorkspacePaths();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [value, setValue] = useState('');
  const [depreciation, setDepreciation] = useState('0');
  const [purchaseDate, setPurchaseDate] = useState('');

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['assets', slug],
    queryFn: async () => {
      const res = await workspaceFetch('/api/assets');
      if (!res.ok) throw new Error('Failed to load assets');
      return (await res.json()) as Asset[];
    },
    enabled: !!slug,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await workspaceFetch('/api/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          type,
          value: Number(value),
          depreciation: Number(depreciation || 0),
          purchaseDate: purchaseDate || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Asset created');
      setName('');
      setType('');
      setValue('');
      setDepreciation('0');
      setPurchaseDate('');
      queryClient.invalidateQueries({ queryKey: ['assets', slug] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Assets</h1>
        <p className="text-sm text-muted-foreground">Company fixed assets and depreciation.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">New asset</CardTitle>
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
          <div className="flex items-end">
            <Button
              disabled={!name.trim() || !type.trim() || !value || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create asset
            </Button>
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
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="text-right">Depreciation</TableHead>
                  <TableHead>Purchased</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assets.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell>{a.type}</TableCell>
                    <TableCell className="text-right">{a.value.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{a.depreciation.toLocaleString()}</TableCell>
                    <TableCell>{new Date(a.purchaseDate).toLocaleDateString()}</TableCell>
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
