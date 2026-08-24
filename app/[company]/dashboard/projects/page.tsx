'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Loader2, FolderKanban } from 'lucide-react';
import { toast } from 'sonner';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { FullTableSkeleton } from '@/components/loading';

type Project = {
  id: string;
  name: string;
  description: string;
  status: string;
  startDate: string;
  endDate: string;
  customerId?: string | null;
  dealId?: string | null;
  customer?: { id: string; organizationName: string } | null;
  deal?: { id: string; title: string } | null;
};

function toDateInput(value?: string | null) {
  if (!value) return '';
  return value.slice(0, 10);
}

export default function ProjectsPage() {
  const { slug, path, workspaceFetch } = useWorkspacePaths();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [dealId, setDealId] = useState('');
  const [editing, setEditing] = useState<Project | null>(null);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects', slug],
    queryFn: async () => {
      const res = await workspaceFetch('/api/projects');
      if (!res.ok) throw new Error('Failed to load projects');
      return (await res.json()) as Project[];
    },
    enabled: !!slug,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['project-customers', slug],
    queryFn: async () => {
      const res = await workspaceFetch('/api/customers?limit=100');
      if (!res.ok) return [];
      const json = await res.json();
      return (json.customers || json || []) as Array<{ id: string; organizationName: string }>;
    },
    enabled: !!slug,
  });

  const { data: deals = [] } = useQuery({
    queryKey: ['project-deals', slug],
    queryFn: async () => {
      const res = await workspaceFetch('/api/deals?limit=100');
      if (!res.ok) return [];
      const json = await res.json();
      return (Array.isArray(json) ? json : json.deals || []) as Array<{ id: string; title: string }>;
    },
    enabled: !!slug,
  });

  const resetForm = () => {
    setName('');
    setDescription('');
    setStatus('ACTIVE');
    setStartDate('');
    setEndDate('');
    setCustomerId('');
    setDealId('');
    setEditing(null);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        description,
        status,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        customerId: customerId || null,
        dealId: dealId || null,
      };
      if (editing) {
        const res = await workspaceFetch(`/api/projects/${editing.id}`, {
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
      const res = await workspaceFetch('/api/projects', {
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
      toast.success(editing ? 'Project updated' : 'Project created');
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['projects', slug] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await workspaceFetch(`/api/projects/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to delete');
      }
    },
    onSuccess: () => {
      toast.success('Project deleted');
      if (editing) resetForm();
      queryClient.invalidateQueries({ queryKey: ['projects', slug] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const startEdit = (p: Project) => {
    setEditing(p);
    setName(p.name);
    setDescription(p.description || '');
    setStatus(p.status || 'ACTIVE');
    setStartDate(toDateInput(p.startDate));
    setEndDate(toDateInput(p.endDate));
    setCustomerId(p.customerId || p.customer?.id || '');
    setDealId(p.dealId || p.deal?.id || '');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Delivery projects</h1>
          <p className="text-sm text-muted-foreground">
            Delivery work for clients — milestones, hours, and requests. Won opportunities
            auto-create a project.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={path('/dashboard/retainers')}>Retainers</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={path('/dashboard/settings/migration')}>Import CSV</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {editing ? `Edit ${editing.name}` : 'New project'}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="proj-name">Name</Label>
            <Input id="proj-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {['ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'].map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="proj-desc">Description</Label>
            <Textarea
              id="proj-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="proj-start">Start date</Label>
            <Input
              id="proj-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="proj-end">End date</Label>
            <Input
              id="proj-end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Customer (optional)</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            >
              <option value="">None</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.organizationName}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Deal (optional)</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={dealId}
              onChange={(e) => setDealId(e.target.value)}
            >
              <option value="">None</option>
              {deals.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2 flex flex-wrap gap-2">
            <Button
              disabled={!name.trim() || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? 'Save changes' : 'Create project'}
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
          <CardTitle className="text-base">All projects</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <FullTableSkeleton columnCount={4} rowCount={5} />
          ) : projects.length === 0 ? (
            <EmptyState
              icon={FolderKanban}
              title="No projects yet"
              description="Create a project above."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Deal</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead className="w-[140px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={path(`/dashboard/projects/${p.id}`)}
                        className="underline-offset-2 hover:underline"
                      >
                        {p.name}
                      </Link>
                      {'progress' in p && typeof (p as { progress?: number }).progress === 'number' ? (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {(p as { progress: number }).progress}%
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>{p.customer?.organizationName || '—'}</TableCell>
                    <TableCell>{p.deal?.title || '—'}</TableCell>
                    <TableCell>{p.status}</TableCell>
                    <TableCell>{new Date(p.startDate).toLocaleDateString()}</TableCell>
                    <TableCell>{new Date(p.endDate).toLocaleDateString()}</TableCell>
                    <TableCell className="space-x-1">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={path(`/dashboard/projects/${p.id}`)}>Open</Link>
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => startEdit(p)}>
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm('Delete this project?')) deleteMutation.mutate(p.id);
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
