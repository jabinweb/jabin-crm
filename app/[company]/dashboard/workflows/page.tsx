'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
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
import Link from 'next/link';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { confirmAction } from '@/lib/confirm-action';

type WorkflowActionDraft = {
  type: 'notify' | 'log' | 'assign' | 'create_task' | 'create_project_task' | 'send_email' | 'send_whatsapp';
  title: string;
  message: string;
  assigneeId: string;
  assigneeMode: 'fixed' | 'round_robin';
  dueInDays: string;
  projectId: string;
  to: string;
  subject: string;
  toPhone: string;
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
  assigneeId: '',
  assigneeMode: 'round_robin',
  dueInDays: '1',
  projectId: '',
  to: '',
  subject: '',
  toPhone: '',
});

function parseActions(raw: unknown): WorkflowActionDraft[] {
  const list = Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? [raw] : [];
  const out = list.map((a) => {
    const row = (a || {}) as Record<string, unknown>;
    const typeRaw = String(row.type || 'notify');
    const type = (
      [
        'notify',
        'log',
        'assign',
        'create_task',
        'create_project_task',
        'send_email',
        'send_whatsapp',
      ].includes(typeRaw)
        ? typeRaw
        : 'notify'
    ) as WorkflowActionDraft['type'];
    return {
      type,
      title: typeof row.title === 'string' ? row.title : '',
      message:
        typeof row.message === 'string'
          ? row.message
          : typeof row.body === 'string'
            ? row.body
            : '',
      assigneeId: typeof row.assigneeId === 'string' ? row.assigneeId : '',
      assigneeMode: row.assigneeMode === 'fixed' ? ('fixed' as const) : ('round_robin' as const),
      dueInDays:
        typeof row.dueInDays === 'number'
          ? String(row.dueInDays)
          : typeof row.dueInDays === 'string'
            ? row.dueInDays
            : '1',
      projectId: typeof row.projectId === 'string' ? row.projectId : '',
      to: typeof row.to === 'string' ? row.to : '',
      subject: typeof row.subject === 'string' ? row.subject : '',
      toPhone: typeof row.toPhone === 'string' ? row.toPhone : '',
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
    if (a.type === 'assign') {
      return {
        type: 'assign',
        assigneeMode: a.assigneeMode,
        assigneeId: a.assigneeMode === 'fixed' ? a.assigneeId.trim() || undefined : undefined,
      };
    }
    if (a.type === 'create_task') {
      return {
        type: 'create_task',
        title: a.title.trim() || undefined,
        message: a.message.trim() || undefined,
        dueInDays: Number(a.dueInDays) || 1,
        assigneeId: a.assigneeId.trim() || undefined,
      };
    }
    if (a.type === 'create_project_task') {
      return {
        type: 'create_project_task',
        projectId: a.projectId.trim() || undefined,
        title: a.title.trim() || undefined,
        message: a.message.trim() || undefined,
        dueInDays: Number(a.dueInDays) || 1,
        assigneeId: a.assigneeId.trim() || undefined,
      };
    }
    if (a.type === 'send_email') {
      return {
        type: 'send_email',
        to: a.to.trim() || undefined,
        subject: a.subject.trim() || a.title.trim() || undefined,
        message: a.message.trim() || undefined,
      };
    }
    if (a.type === 'send_whatsapp') {
      return {
        type: 'send_whatsapp',
        toPhone: a.toPhone.trim() || undefined,
        message: a.message.trim() || undefined,
      };
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
  const { path } = useWorkspacePaths();
  const [createOpen, setCreateOpen] = useState(false);
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
      setCreateOpen(false);
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
                  type: e.target.value as WorkflowActionDraft['type'],
                };
                onChange(next);
              }}
            >
              <option value="notify">Notify (in-app)</option>
              <option value="log">Log only</option>
              <option value="assign">Assign lead / ticket</option>
              <option value="create_task">Create CRM task</option>
              <option value="create_project_task">Create project task</option>
              <option value="send_email">Send email</option>
              <option value="send_whatsapp">Send WhatsApp</option>
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

          {action.type === 'notify' ||
          action.type === 'create_task' ||
          action.type === 'create_project_task' ? (
            <Input
              value={action.title}
              onChange={(e) => {
                const next = [...value];
                next[idx] = { ...action, title: e.target.value };
                onChange(next);
              }}
              placeholder={
                action.type === 'create_task' || action.type === 'create_project_task'
                  ? 'Task title'
                  : 'Notification title'
              }
              className="h-9"
            />
          ) : null}

          {action.type === 'create_project_task' ? (
            <Input
              value={action.projectId}
              onChange={(e) => {
                const next = [...value];
                next[idx] = { ...action, projectId: e.target.value };
                onChange(next);
              }}
              placeholder="Project ID (or from event payload)"
              className="h-9"
            />
          ) : null}

          {action.type === 'assign' ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <select
                className="flex h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={action.assigneeMode}
                onChange={(e) => {
                  const next = [...value];
                  next[idx] = {
                    ...action,
                    assigneeMode: e.target.value as 'fixed' | 'round_robin',
                  };
                  onChange(next);
                }}
              >
                <option value="round_robin">Round-robin agent</option>
                <option value="fixed">Fixed user ID</option>
              </select>
              {action.assigneeMode === 'fixed' ? (
                <Input
                  value={action.assigneeId}
                  onChange={(e) => {
                    const next = [...value];
                    next[idx] = { ...action, assigneeId: e.target.value };
                    onChange(next);
                  }}
                  placeholder="Assignee user ID"
                  className="h-9"
                />
              ) : null}
            </div>
          ) : null}

          {action.type === 'create_task' || action.type === 'create_project_task' ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <Input
                value={action.dueInDays}
                onChange={(e) => {
                  const next = [...value];
                  next[idx] = { ...action, dueInDays: e.target.value };
                  onChange(next);
                }}
                placeholder="Due in days"
                className="h-9"
              />
              <Input
                value={action.assigneeId}
                onChange={(e) => {
                  const next = [...value];
                  next[idx] = { ...action, assigneeId: e.target.value };
                  onChange(next);
                }}
                placeholder="Assignee user ID (optional)"
                className="h-9"
              />
            </div>
          ) : null}

          {action.type === 'send_email' ? (
            <div className="grid gap-2">
              <Input
                value={action.to}
                onChange={(e) => {
                  const next = [...value];
                  next[idx] = { ...action, to: e.target.value };
                  onChange(next);
                }}
                placeholder="To (blank = lead/customer email)"
                className="h-9"
              />
              <Input
                value={action.subject}
                onChange={(e) => {
                  const next = [...value];
                  next[idx] = { ...action, subject: e.target.value };
                  onChange(next);
                }}
                placeholder="Subject — supports {{title}}"
                className="h-9"
              />
            </div>
          ) : null}

          {action.type === 'send_whatsapp' ? (
            <Input
              value={action.toPhone}
              onChange={(e) => {
                const next = [...value];
                next[idx] = { ...action, toPhone: e.target.value };
                onChange(next);
              }}
              placeholder="Phone (blank = lead/customer phone)"
              className="h-9"
            />
          ) : null}

          {action.type !== 'assign' ? (
            <Textarea
              rows={2}
              value={action.message}
              onChange={(e) => {
                const next = [...value];
                next[idx] = { ...action, message: e.target.value };
                onChange(next);
              }}
              placeholder={
                action.type === 'notify'
                  ? 'Notification body'
                  : action.type === 'log'
                    ? 'Log message'
                    : 'Message body — {{title}} {{summary}}'
              }
            />
          ) : null}
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Workflows</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Event workflows (leads, deals, tickets) — separate from{' '}
            <Link
              href={path('/dashboard/support/automation')}
              className="text-primary underline underline-offset-2"
            >
              ticket automation
            </Link>{' '}
            under Support.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New workflow
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          {isLoading ? (
            <TableSkeleton columnCount={5} rowCount={5} />
          ) : workflows.length === 0 ? (
            <EmptyState
              icon={Zap}
              title="No workflows yet"
              description="Create a workflow to automate follow-ups and assignments."
              actionLabel="New workflow"
              onAction={() => setCreateOpen(true)}
            />
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Trigger</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Runs</TableHead>
                    <TableHead className="w-[180px]" />
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
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) {
            setName('');
            setDescription('');
            setTrigger('lead.created');
            setConditions(emptyConditions());
            setActions([defaultAction('lead.created')]);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>New workflow</DialogTitle>
            <DialogDescription>
              Set trigger, optional filters, and one or more actions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!name.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              onClick={async () => {
                if (
                  editId &&
                  (await confirmAction({
                    title: 'Delete this workflow?',
                    description: 'This cannot be undone.',
                    confirmLabel: 'Delete',
                    variant: 'destructive',
                  }))
                ) {
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
