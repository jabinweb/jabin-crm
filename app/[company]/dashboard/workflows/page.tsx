'use client';

import { useEffect, useState } from 'react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Loader2, Plus, Trash2, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { TableSkeleton } from '@/components/loading';
import { formatDistanceToNow } from 'date-fns';

type WorkflowActionDraft = {
  type: 'notify' | 'log';
  title: string;
  message: string;
};

type WorkflowConditionsDraft = {
  status: string;
  priority: string;
  channel: string;
  source: string;
  newStatus: string;
};

type WorkflowRow = {
  id: string;
  name: string;
  description: string | null;
  trigger: string;
  isActive: boolean;
  updatedAt: string;
  conditions?: unknown;
  actions?: unknown;
  _count?: { executions: number };
};

type WorkflowDetail = WorkflowRow & {
  executions: Array<{
    id: string;
    status: string;
    executedAt: string;
    result?: unknown;
  }>;
};

const TRIGGERS = [
  { value: 'lead.created', label: 'lead.created — new lead' },
  { value: 'lead.updated', label: 'lead.updated — lead status change' },
  { value: 'ticket.created', label: 'ticket.created — new ticket' },
  { value: 'ticket.updated', label: 'ticket.updated — ticket status change' },
  { value: 'deal.won', label: 'deal.won — deal marked won' },
] as const;

const emptyConditions = (): WorkflowConditionsDraft => ({
  status: '',
  priority: '',
  channel: '',
  source: '',
  newStatus: '',
});

const defaultAction = (trigger: string): WorkflowActionDraft => ({
  type: 'notify',
  title: 'Workflow fired',
  message: `Trigger: ${trigger}`,
});

function parseActions(raw: unknown): WorkflowActionDraft[] {
  const list = Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? [raw] : [];
  const out = list.map((a) => {
    const row = (a || {}) as Record<string, unknown>;
    const type = row.type === 'log' ? 'log' : 'notify';
    return {
      type: type as 'notify' | 'log',
      title: typeof row.title === 'string' ? row.title : '',
      message: typeof row.message === 'string' ? row.message : '',
    };
  });
  return out.length ? out : [defaultAction('lead.created')];
}

function parseConditionsDraft(raw: unknown): WorkflowConditionsDraft {
  const base = emptyConditions();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base;
  const c = raw as Record<string, unknown>;
  for (const key of Object.keys(base) as (keyof WorkflowConditionsDraft)[]) {
    if (typeof c[key] === 'string') base[key] = c[key];
  }
  return base;
}

function conditionsPayload(c: WorkflowConditionsDraft) {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(c)) {
    if (v.trim()) out[k] = v.trim();
  }
  return out;
}

function actionsPayload(actions: WorkflowActionDraft[]) {
  return actions.map((a) => {
    if (a.type === 'log') {
      return { type: 'log', message: a.message.trim() || undefined };
    }
    return {
      type: 'notify',
      title: a.title.trim() || 'Workflow fired',
      message: a.message.trim() || undefined,
    };
  });
}

export default function WorkflowsPage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [trigger, setTrigger] = useState('lead.created');
  const [conditions, setConditions] = useState<WorkflowConditionsDraft>(emptyConditions);
  const [actions, setActions] = useState<WorkflowActionDraft[]>([defaultAction('lead.created')]);

  const [editId, setEditId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editTrigger, setEditTrigger] = useState('lead.created');
  const [editConditions, setEditConditions] =
    useState<WorkflowConditionsDraft>(emptyConditions);
  const [editActions, setEditActions] = useState<WorkflowActionDraft[]>([
    defaultAction('lead.created'),
  ]);

  const { data, isLoading } = useQuery({
    queryKey: ['workflows'],
    queryFn: async () => {
      const res = await fetch('/api/workflows');
      if (!res.ok) throw new Error('Failed to load workflows');
      return (await res.json()) as { workflows: WorkflowRow[] };
    },
  });

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ['workflow', editId],
    enabled: !!editId && editOpen,
    queryFn: async () => {
      const res = await fetch(`/api/workflows/${editId}`);
      if (!res.ok) throw new Error('Failed to load workflow');
      return (await res.json()) as WorkflowDetail;
    },
  });

  useEffect(() => {
    if (!detail) return;
    setEditName(detail.name);
    setEditDescription(detail.description || '');
    setEditTrigger(detail.trigger);
    setEditConditions(parseConditionsDraft(detail.conditions));
    setEditActions(parseActions(detail.actions));
  }, [detail]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: description || null,
          trigger,
          conditions: conditionsPayload(conditions),
          actions: actionsPayload(actions),
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
      setTrigger('lead.created');
      setConditions(emptyConditions());
      setActions([defaultAction('lead.created')]);
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!editId) return;
      const res = await fetch(`/api/workflows/${editId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          description: editDescription || null,
          trigger: editTrigger,
          conditions: conditionsPayload(editConditions),
          actions: actionsPayload(editActions),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Workflow updated');
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      queryClient.invalidateQueries({ queryKey: ['workflow', editId] });
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

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/workflows/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
    },
    onSuccess: () => {
      toast.success('Workflow deleted');
      setEditOpen(false);
      setEditId(null);
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const workflows = data?.workflows ?? [];

  const ConditionsFields = ({
    value,
    onChange,
  }: {
    value: WorkflowConditionsDraft;
    onChange: (next: WorkflowConditionsDraft) => void;
  }) => (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label className="text-xs">Status equals</Label>
        <Input
          value={value.status}
          onChange={(e) => onChange({ ...value, status: e.target.value })}
          placeholder="e.g. OPEN / CONTACTED"
          className="h-9"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">New status equals</Label>
        <Input
          value={value.newStatus}
          onChange={(e) => onChange({ ...value, newStatus: e.target.value })}
          placeholder="Lead status after change"
          className="h-9"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Priority equals</Label>
        <Input
          value={value.priority}
          onChange={(e) => onChange({ ...value, priority: e.target.value })}
          placeholder="e.g. HIGH"
          className="h-9"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Channel equals</Label>
        <Input
          value={value.channel}
          onChange={(e) => onChange({ ...value, channel: e.target.value })}
          placeholder="e.g. WHATSAPP"
          className="h-9"
        />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label className="text-xs">Source equals</Label>
        <Input
          value={value.source}
          onChange={(e) => onChange({ ...value, source: e.target.value })}
          placeholder="Lead source"
          className="h-9"
        />
      </div>
      <p className="text-xs text-muted-foreground sm:col-span-2">
        Leave blank to match all. Conditions are AND’d against event metadata.
      </p>
    </div>
  );

  const ActionsEditor = ({
    value,
    onChange,
  }: {
    value: WorkflowActionDraft[];
    onChange: (next: WorkflowActionDraft[]) => void;
  }) => (
    <div className="space-y-3">
      {value.map((action, idx) => (
        <div key={idx} className="rounded-lg border p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <select
              className="flex h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={action.type}
              onChange={(e) => {
                const next = [...value];
                next[idx] = {
                  ...action,
                  type: e.target.value as 'notify' | 'log',
                };
                onChange(next);
              }}
            >
              <option value="notify">Notify (in-app)</option>
              <option value="log">Log only</option>
            </select>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-destructive"
              disabled={value.length <= 1}
              onClick={() => onChange(value.filter((_, i) => i !== idx))}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          {action.type === 'notify' ? (
            <Input
              value={action.title}
              onChange={(e) => {
                const next = [...value];
                next[idx] = { ...action, title: e.target.value };
                onChange(next);
              }}
              placeholder="Notification title"
              className="h-9"
            />
          ) : null}
          <Textarea
            rows={2}
            value={action.message}
            onChange={(e) => {
              const next = [...value];
              next[idx] = { ...action, message: e.target.value };
              onChange(next);
            }}
            placeholder={action.type === 'notify' ? 'Notification body' : 'Log message'}
          />
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...value, defaultAction(trigger)])}
      >
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        Add action
      </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Workflows</h1>
        <p className="text-sm text-muted-foreground">
          Trigger → conditions → actions for CRM events. Ticket-specific rules also live under
          Support → Automation.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">New workflow</CardTitle>
          <CardDescription>Set trigger, optional filters, and one or more actions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 max-w-2xl">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Notify on new lead"
            />
          </div>
          <div className="space-y-2">
            <Label>Trigger</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={trigger}
              onChange={(e) => {
                setTrigger(e.target.value);
                setActions((prev) =>
                  prev.map((a) =>
                    a.message.startsWith('Trigger:')
                      ? { ...a, message: `Trigger: ${e.target.value}` }
                      : a
                  )
                );
              }}
            >
              {TRIGGERS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Conditions (optional)</Label>
            <ConditionsFields value={conditions} onChange={setConditions} />
          </div>
          <div className="space-y-2">
            <Label>Actions</Label>
            <ActionsEditor value={actions} onChange={setActions} />
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
            <TableSkeleton columnCount={5} rowCount={5} />
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
                    <TableCell className="text-right space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditId(w.id);
                          setEditOpen(true);
                        }}
                      >
                        Edit
                      </Button>
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

      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) setEditId(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit workflow</DialogTitle>
            <DialogDescription>Update conditions, actions, and review recent runs.</DialogDescription>
          </DialogHeader>
          {detailLoading && !detail ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Trigger</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={editTrigger}
                  onChange={(e) => setEditTrigger(e.target.value)}
                >
                  {TRIGGERS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  rows={2}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Conditions</Label>
                <ConditionsFields value={editConditions} onChange={setEditConditions} />
              </div>
              <div className="space-y-2">
                <Label>Actions</Label>
                <ActionsEditor value={editActions} onChange={setEditActions} />
              </div>
              <div className="space-y-2">
                <Label>Recent runs</Label>
                <div className="max-h-40 overflow-auto rounded-md border divide-y">
                  {(detail?.executions || []).length === 0 ? (
                    <p className="px-3 py-4 text-sm text-muted-foreground">No runs yet</p>
                  ) : (
                    detail?.executions.map((ex) => (
                      <div
                        key={ex.id}
                        className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                      >
                        <Badge variant={ex.status === 'SUCCESS' ? 'default' : 'destructive'}>
                          {ex.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(ex.executedAt), { addSuffix: true })}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (editId && window.confirm('Delete this workflow?')) {
                  deleteMutation.mutate(editId);
                }
              }}
            >
              Delete
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                Close
              </Button>
              <Button
                type="button"
                onClick={() => saveMutation.mutate()}
                disabled={!editName.trim() || saveMutation.isPending}
              >
                {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
