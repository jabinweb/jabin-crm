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
import { Loader2, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { FullTableSkeleton } from '@/components/loading';
import { confirmAction } from '@/lib/confirm-action';

type Supplier = {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  rating: number | null;
};

export default function SuppliersPage() {
  const { slug, path, workspaceFetch } = useWorkspacePaths();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [rating, setRating] = useState('');
  const [editing, setEditing] = useState<Supplier | null>(null);

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ['suppliers', slug],
    queryFn: async () => {
      const res = await workspaceFetch('/api/suppliers');
      if (!res.ok) throw new Error('Failed to load suppliers');
      return (await res.json()) as Supplier[];
    },
    enabled: !!slug,
  });

  const resetForm = () => {
    setName('');
    setEmail('');
    setPhone('');
    setAddress('');
    setRating('');
    setEditing(null);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        email,
        phone,
        address,
        rating: rating ? Number(rating) : undefined,
      };
      if (editing) {
        const res = await workspaceFetch(`/api/suppliers/${editing.id}`, {
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
      const res = await workspaceFetch('/api/suppliers', {
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
      toast.success(editing ? 'Supplier updated' : 'Supplier created');
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['suppliers', slug] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await workspaceFetch(`/api/suppliers/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to delete');
      }
    },
    onSuccess: () => {
      toast.success('Supplier deleted');
      if (editing) resetForm();
      queryClient.invalidateQueries({ queryKey: ['suppliers', slug] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const startEdit = (s: Supplier) => {
    setEditing(s);
    setName(s.name);
    setEmail(s.email);
    setPhone(s.phone);
    setAddress(s.address);
    setRating(s.rating != null ? String(s.rating) : '');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Suppliers</h1>
          <p className="text-sm text-muted-foreground">Manage procurement vendors.</p>
        </div>
        <Button variant="outline" asChild>
          <Link href={path('/dashboard/settings/migration') + '?object=suppliers'}>
            Import CSV
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {editing ? `Edit ${editing.name}` : 'New supplier'}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="sup-name">Name</Label>
            <Input id="sup-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sup-email">Email</Label>
            <Input
              id="sup-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sup-phone">Phone</Label>
            <Input id="sup-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sup-rating">Rating (optional)</Label>
            <Input
              id="sup-rating"
              type="number"
              min={0}
              max={5}
              step={0.1}
              value={rating}
              onChange={(e) => setRating(e.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="sup-address">Address</Label>
            <Input
              id="sup-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2 flex flex-wrap gap-2">
            <Button
              disabled={
                !name.trim() ||
                !email.trim() ||
                !phone.trim() ||
                !address.trim() ||
                saveMutation.isPending
              }
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? 'Save changes' : 'Create supplier'}
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
          <CardTitle className="text-base">All suppliers</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <FullTableSkeleton columnCount={5} rowCount={5} />
          ) : suppliers.length === 0 ? (
            <EmptyState
              icon={Truck}
              title="No suppliers yet"
              description="Add your first supplier above, or import a CSV."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead className="w-[140px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{s.email}</TableCell>
                    <TableCell>{s.phone}</TableCell>
                    <TableCell>{s.rating ?? '—'}</TableCell>
                    <TableCell className="space-x-1">
                      <Button variant="ghost" size="sm" onClick={() => startEdit(s)}>
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          if (
                            !(await confirmAction({
                              title: 'Delete this supplier?',
                              description: 'This cannot be undone.',
                              confirmLabel: 'Delete',
                              variant: 'destructive',
                            }))
                          )
                            return;
                          deleteMutation.mutate(s.id);
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
