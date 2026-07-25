'use client';

import { useState } from 'react';
import Link from 'next/link';
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
import { Loader2, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { FullTableSkeleton } from '@/components/loading';

type Location = {
  id: string;
  name: string;
  type: string;
  code: string;
  address: string;
};

const LOCATION_TYPES = ['WAREHOUSE', 'STORE', 'VAN'] as const;

export default function LocationsPage() {
  const { slug, path, workspaceFetch } = useWorkspacePaths();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [type, setType] = useState<string>('WAREHOUSE');
  const [address, setAddress] = useState('');
  const [code, setCode] = useState('');
  const [editing, setEditing] = useState<Location | null>(null);

  const { data: locations = [], isLoading } = useQuery({
    queryKey: ['locations', slug],
    queryFn: async () => {
      const res = await workspaceFetch('/api/locations');
      if (!res.ok) throw new Error('Failed to load locations');
      return (await res.json()) as Location[];
    },
    enabled: !!slug,
  });

  const resetForm = () => {
    setName('');
    setType('WAREHOUSE');
    setAddress('');
    setCode('');
    setEditing(null);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing) {
        const res = await workspaceFetch(`/api/locations/${editing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, type, address }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to update');
        }
        return res.json();
      }
      const res = await workspaceFetch('/api/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          type,
          address,
          code: code.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success(editing ? 'Location updated' : 'Location created');
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['locations', slug] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await workspaceFetch(`/api/locations/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to delete');
      }
    },
    onSuccess: () => {
      toast.success('Location deleted');
      if (editing) resetForm();
      queryClient.invalidateQueries({ queryKey: ['locations', slug] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const startEdit = (loc: Location) => {
    setEditing(loc);
    setName(loc.name);
    setType(loc.type);
    setAddress(loc.address);
    setCode(loc.code);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Locations</h1>
          <p className="text-sm text-muted-foreground">
            Warehouses, stores, and vans used for stock transfers and demo fleet.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href={path('/dashboard/inventory')}>Installed equipment</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={path('/dashboard/inventory/transfers')}>Transfers</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={path('/dashboard/demo-equipment')}>Demo fleet</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={path('/dashboard/settings/migration') + '?object=locations'}>
              Import CSV
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {editing ? `Edit ${editing.name}` : 'New location'}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="loc-name">Name</Label>
            <Input id="loc-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOCATION_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="loc-address">Address</Label>
            <Input
              id="loc-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
          {!editing && (
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="loc-code">Code (optional)</Label>
              <Input
                id="loc-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Auto-generated if empty"
              />
            </div>
          )}
          <div className="sm:col-span-2 flex flex-wrap gap-2">
            <Button
              disabled={
                !name.trim() || !address.trim() || !type || saveMutation.isPending
              }
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? 'Save changes' : 'Create location'}
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
          <CardTitle className="text-base">All locations</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <FullTableSkeleton columnCount={5} rowCount={5} />
          ) : locations.length === 0 ? (
            <EmptyState
              icon={MapPin}
              title="No locations yet"
              description="Create a warehouse or store so transfers and demo fleet can use it."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead className="w-[140px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {locations.map((loc) => (
                  <TableRow key={loc.id}>
                    <TableCell className="font-medium">{loc.name}</TableCell>
                    <TableCell>{loc.type}</TableCell>
                    <TableCell className="font-mono text-xs">{loc.code}</TableCell>
                    <TableCell className="max-w-[240px] truncate">{loc.address}</TableCell>
                    <TableCell className="space-x-1">
                      <Button variant="ghost" size="sm" onClick={() => startEdit(loc)}>
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm('Delete this location?')) deleteMutation.mutate(loc.id);
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
