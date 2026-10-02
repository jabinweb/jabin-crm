'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Loader2, Plus, Target } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { CardListSkeleton } from '@/components/loading';
import { QueryErrorState, StatusBadge } from '@/components/hr/hr-ui';

const SELECT_CLASS =
  'h-10 w-full rounded-md border border-input bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm';

export default function PerformanceAdminPage() {
  const qc = useQueryClient();
  const [cycleDialogOpen, setCycleDialogOpen] = useState(false);
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [cycleId, setCycleId] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [goalTitle, setGoalTitle] = useState('');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['perf-admin'],
    queryFn: async () => {
      const res = await fetch('/api/hr/performance?admin=1');
      if (!res.ok) throw new Error('Failed');
      return res.json() as Promise<{
        cycles: {
          id: string;
          name: string;
          status: string;
          startDate: string;
          endDate: string;
          _count: { goals: number; reviews: number };
        }[];
      }>;
    },
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['hr-dir-perf'],
    queryFn: async () => {
      const res = await fetch('/api/hr/directory');
      if (!res.ok) return [];
      return (await res.json()) as { id: string; name: string; employeeId: string }[];
    },
  });

  const resetCycleForm = () => {
    setName('');
    setStart('');
    setEnd('');
  };

  const resetGoalForm = () => {
    setCycleId('');
    setEmployeeId('');
    setGoalTitle('');
  };

  const createCycle = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/hr/performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_cycle',
          name: name.trim(),
          startDate: start,
          endDate: end,
        }),
      });
      if (!res.ok) throw new Error('Failed');
    },
    onSuccess: () => {
      toast.success(`Cycle “${name.trim()}” created`);
      resetCycleForm();
      setCycleDialogOpen(false);
      void qc.invalidateQueries({ queryKey: ['perf-admin'] });
    },
    onError: () => toast.error('Failed to create cycle'),
  });

  const addGoal = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/hr/performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_goal',
          cycleId,
          employeeId,
          title: goalTitle.trim(),
        }),
      });
      if (!res.ok) throw new Error('Failed');
    },
    onSuccess: () => {
      toast.success('Goal added');
      resetGoalForm();
      setGoalDialogOpen(false);
      void qc.invalidateQueries({ queryKey: ['perf-admin'] });
    },
    onError: () => toast.error('Failed to add goal'),
  });

  const cycles = data?.cycles || [];
  const endBeforeStart = Boolean(start && end && end < start);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Performance</h1>
          <p className="text-sm text-muted-foreground">
            Run review cycles and assign goals to employees.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={cycles.length === 0}
            title={cycles.length === 0 ? 'Create a cycle first' : undefined}
            onClick={() => {
              resetGoalForm();
              setGoalDialogOpen(true);
            }}
          >
            Add goal
          </Button>
          <Button
            onClick={() => {
              resetCycleForm();
              setCycleDialogOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            New cycle
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 space-y-2">
          {isLoading ? (
            <CardListSkeleton rows={3} />
          ) : isError ? (
            <QueryErrorState title="Couldn’t load review cycles" onRetry={() => void refetch()} />
          ) : cycles.length === 0 ? (
            <EmptyState
              icon={Target}
              title="No cycles yet"
              description="Create a performance cycle to start tracking goals and reviews."
              actionLabel="New cycle"
              onAction={() => {
                resetCycleForm();
                setCycleDialogOpen(true);
              }}
            />
          ) : (
            cycles.map((c) => (
              <div key={c.id} className="flex justify-between gap-2 rounded-lg border p-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(c.startDate), 'd MMM yyyy')} – {format(new Date(c.endDate), 'd MMM yyyy')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {c._count.goals} goal{c._count.goals === 1 ? '' : 's'} · {c._count.reviews} review
                    {c._count.reviews === 1 ? '' : 's'}
                  </p>
                </div>
                <StatusBadge status={c.status} className="self-start" />
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog
        open={cycleDialogOpen}
        onOpenChange={(open) => {
          setCycleDialogOpen(open);
          if (!open) resetCycleForm();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New cycle</DialogTitle>
            <DialogDescription>Create a performance review cycle.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="cycle-name">Name</Label>
              <Input
                id="cycle-name"
                placeholder="H2 2026 review"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cycle-start">Start date</Label>
                <Input id="cycle-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cycle-end">End date</Label>
                <Input
                  id="cycle-end"
                  type="date"
                  min={start || undefined}
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  aria-invalid={endBeforeStart || undefined}
                />
              </div>
            </div>
            {endBeforeStart && (
              <p className="text-xs text-destructive">End date must be on or after the start date.</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCycleDialogOpen(false);
                resetCycleForm();
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={!name.trim() || !start || !end || endBeforeStart || createCycle.isPending}
              onClick={() => createCycle.mutate()}
            >
              {createCycle.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create cycle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={goalDialogOpen}
        onOpenChange={(open) => {
          setGoalDialogOpen(open);
          if (!open) resetGoalForm();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add goal</DialogTitle>
            <DialogDescription>Assign a goal to an employee for a cycle.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="goal-cycle">Cycle</Label>
              <select
                id="goal-cycle"
                className={SELECT_CLASS}
                value={cycleId}
                onChange={(e) => setCycleId(e.target.value)}
              >
                <option value="">Select a cycle</option>
                {cycles.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="goal-employee">Employee</Label>
              <select
                id="goal-employee"
                className={SELECT_CLASS}
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
              >
                <option value="">Select an employee</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} ({e.employeeId})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="goal-title">Goal</Label>
              <Input
                id="goal-title"
                placeholder="Close 20 new accounts this quarter"
                value={goalTitle}
                onChange={(e) => setGoalTitle(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setGoalDialogOpen(false);
                resetGoalForm();
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={!cycleId || !employeeId || !goalTitle.trim() || addGoal.isPending}
              onClick={() => addGoal.mutate()}
            >
              {addGoal.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add goal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
