'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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

  const { data, isLoading } = useQuery({
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
          name,
          startDate: start,
          endDate: end,
        }),
      });
      if (!res.ok) throw new Error('Failed');
    },
    onSuccess: () => {
      toast.success('Cycle created');
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
          title: goalTitle,
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Performance</h1>
          <p className="text-sm text-muted-foreground">Cycles, goals, and reviews.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
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
            <p className="text-sm text-muted-foreground">Loading…</p>
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
              <div key={c.id} className="flex justify-between rounded-lg border p-3">
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {c._count.goals} goals · {c._count.reviews} reviews
                  </p>
                </div>
                <Badge>{c.status}</Badge>
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
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Start</Label>
              <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>End</Label>
              <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
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
              disabled={!name || !start || !end || createCycle.isPending}
              onClick={() => createCycle.mutate()}
            >
              {createCycle.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create
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
              <Label>Cycle</Label>
              <select
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={cycleId}
                onChange={(e) => setCycleId(e.target.value)}
              >
                <option value="">Cycle…</option>
                {cycles.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Employee</Label>
              <select
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
              >
                <option value="">Employee…</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Goal title</Label>
              <Input
                placeholder="Goal title"
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
              disabled={!cycleId || !employeeId || !goalTitle || addGoal.isPending}
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
