'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/ui/empty-state';
import { Loader2, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { TableSkeleton } from '@/components/loading';

type WorkflowRow = {
  id: string;
  name: string;
  description: string | null;
  trigger: string;
  isActive: boolean;
  updatedAt: string;
  _count?: { executions: number };
};

export default function WorkflowsPage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [trigger, setTrigger] = useState('lead.created');

  const { data, isLoading } = useQuery({
    queryKey: ['workflows'],
    queryFn: async () => {
      const res = await fetch('/api/workflows');
      if (!res.ok) throw new Error('Failed to load workflows');
      return (await res.json()) as { workflows: WorkflowRow[] };
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: description || null,
          trigger,
          conditions: {},
          actions: [{ type: 'notify', title: 'Workflow fired', message: `Trigger: ${trigger}` }],
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Workflow created');
      setName('');
      setDescription('');
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/workflows/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) throw new Error('Failed to update');
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workflows'] }),
  });

  const workflows = data?.workflows ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Workflows</h1>
        <p className="text-sm text-muted-foreground">
          Define trigger → action automations for your CRM. Ticket automation still lives under
          Support tools.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">New workflow</CardTitle>
          <CardDescription>Start with a named trigger; expand actions anytime.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 max-w-xl">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Notify on new lead" />
          </div>
          <div className="space-y-2">
            <Label>Trigger key</Label>
            <Input
              value={trigger}
              onChange={(e) => setTrigger(e.target.value)}
              placeholder="lead.created"
            />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <Button
            disabled={!name.trim() || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your workflows</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton columnCount={4} rowCount={5} />
          ) : workflows.length === 0 ? (
            <EmptyState
              icon={Zap}
              title="No workflows yet"
              description="Create a workflow above to automate CRM steps."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Runs</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {workflows.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell className="font-medium">{w.name}</TableCell>
                    <TableCell className="font-mono text-xs">{w.trigger}</TableCell>
                    <TableCell>
                      <Badge variant={w.isActive ? 'default' : 'secondary'}>
                        {w.isActive ? 'Active' : 'Paused'}
                      </Badge>
                    </TableCell>
                    <TableCell>{w._count?.executions ?? 0}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          toggleMutation.mutate({ id: w.id, isActive: !w.isActive })
                        }
                      >
                        {w.isActive ? 'Pause' : 'Activate'}
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
