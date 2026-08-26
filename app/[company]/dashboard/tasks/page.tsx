'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Phone, Mail, Calendar, CheckCircle2, Clock, AlertCircle, Pencil, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { PageHeaderSkeleton, StatCardsSkeleton, CardListSkeleton } from '@/components/loading';
import { EmptyState } from '@/components/ui/empty-state';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { confirmAction } from '@/lib/confirm-action';

interface Task {
  id: string;
  title: string;
  description: string;
  type: string;
  priority: string;
  status: string;
  dueDate: string | null;
  lead?: {
    companyName: string;
  };
  deal?: {
    title: string;
  };
}

interface TaskStats {
  pending: number;
  inProgress: number;
  completed: number;
  overdue: number;
}

const EMPTY_FORM = {
  title: '',
  description: '',
  type: 'TODO',
  priority: 'MEDIUM',
  dueDate: '',
};

export default function TasksPage() {
  const { workspaceFetch } = useWorkspacePaths();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<TaskStats>({ pending: 0, inProgress: 0, completed: 0, overdue: 0 });
  const [filter, setFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const fetchTasks = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filter === 'overdue') params.append('overdue', 'true');
      else if (filter !== 'all') params.append('status', filter.toUpperCase());

      const res = await workspaceFetch(`/api/tasks?${params}`);
      if (res.ok) {
        const data = await res.json();
        setTasks(Array.isArray(data) ? data : data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    } finally {
      setLoading(false);
    }
  }, [filter, workspaceFetch]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await workspaceFetch('/api/tasks/stats');
      if (res.ok) {
        setStats(await res.json());
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  }, [workspaceFetch]);

  useEffect(() => {
    void fetchTasks();
    void fetchStats();
  }, [fetchTasks, fetchStats]);

  const updateTaskStatus = async (taskId: string, status: string) => {
    try {
      const res = await workspaceFetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        void fetchTasks();
        void fetchStats();
      } else {
        toast.error('Failed to update task');
      }
    } catch (error) {
      console.error('Failed to update task:', error);
      toast.error('Failed to update task');
    }
  };

  const createTask = async () => {
    if (!form.title.trim()) {
      toast.error('Title is required');
      return;
    }
    setCreating(true);
    try {
      const res = await workspaceFetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description || undefined,
          type: form.type,
          priority: form.priority,
          dueDate: form.dueDate || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create task');
      }
      toast.success('Task created');
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      void fetchTasks();
      void fetchStats();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create task');
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (task: Task) => {
    setEditingTask(task);
    setForm({
      title: task.title,
      description: task.description || '',
      type: task.type || 'TODO',
      priority: task.priority || 'MEDIUM',
      dueDate: task.dueDate ? task.dueDate.slice(0, 10) : '',
    });
    setEditOpen(true);
  };

  const saveTask = async () => {
    if (!editingTask) return;
    if (!form.title.trim()) {
      toast.error('Title is required');
      return;
    }
    setSaving(true);
    try {
      const res = await workspaceFetch(`/api/tasks/${editingTask.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description,
          type: form.type,
          priority: form.priority,
          dueDate: form.dueDate || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update task');
      }
      toast.success('Task updated');
      setEditOpen(false);
      setEditingTask(null);
      setForm(EMPTY_FORM);
      void fetchTasks();
      void fetchStats();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update task');
    } finally {
      setSaving(false);
    }
  };

  const deleteTask = async (taskId: string) => {
    if (
      !(await confirmAction({
        title: 'Delete this task?',
        description: 'This cannot be undone.',
        confirmLabel: 'Delete',
        variant: 'destructive',
      }))
    )
      return;
    try {
      const res = await workspaceFetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to delete task');
      }
      toast.success('Task deleted');
      if (editingTask?.id === taskId) {
        setEditOpen(false);
        setEditingTask(null);
        setForm(EMPTY_FORM);
      }
      void fetchTasks();
      void fetchStats();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete task');
    }
  };

  const getTaskIcon = (type: string) => {
    switch (type) {
      case 'CALL': return <Phone className="h-4 w-4" />;
      case 'EMAIL': return <Mail className="h-4 w-4" />;
      case 'MEETING': return <Calendar className="h-4 w-4" />;
      default: return <CheckCircle2 className="h-4 w-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT': return 'bg-red-500';
      case 'HIGH': return 'bg-orange-500';
      case 'MEDIUM': return 'bg-yellow-500';
      default: return 'bg-blue-500';
    }
  };

  const isOverdue = (dueDate: string | null) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeaderSkeleton />
        <StatCardsSkeleton count={4} />
        <CardListSkeleton rows={5} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Follow-ups</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Sales activities on leads and deals — not project delivery work
          </p>
          <p className="text-sm md:text-base text-muted-foreground">Manage your sales activities</p>
        </div>
        <Button
          className="w-full sm:w-auto"
          onClick={() => {
            setForm(EMPTY_FORM);
            setCreateOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          New Task
        </Button>
      </div>

      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.inProgress}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{stats.overdue}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="in_progress">In Progress</TabsTrigger>
          <TabsTrigger value="overdue">Overdue</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>

        <TabsContent value={filter} className="space-y-4 mt-4">
          {tasks.length === 0 ? (
            <Card>
              <CardContent>
                <EmptyState
                  icon={CheckCircle2}
                  title={filter === 'all' ? 'No tasks yet' : 'No tasks found'}
                  description={
                    filter === 'all'
                      ? 'Create your first task to get started.'
                      : `No ${filter.replace('_', ' ')} tasks.`
                  }
                  actionLabel={filter === 'all' ? 'New Task' : undefined}
                  onAction={
                    filter === 'all'
                      ? () => {
                          setForm(EMPTY_FORM);
                          setCreateOpen(true);
                        }
                      : undefined
                  }
                />
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => (
                <Card key={task.id} className="hover:shadow-none transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <Checkbox
                        checked={task.status === 'COMPLETED'}
                        onCheckedChange={(checked) =>
                          void updateTaskStatus(task.id, checked ? 'COMPLETED' : 'PENDING')
                        }
                        className="mt-1"
                      />

                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          {getTaskIcon(task.type)}
                          <h3 className={`font-semibold ${task.status === 'COMPLETED' ? 'line-through text-muted-foreground' : ''}`}>
                            {task.title}
                          </h3>
                        </div>

                        {task.description && (
                          <p className="text-sm text-muted-foreground">{task.description}</p>
                        )}

                        <div className="flex items-center gap-2 text-sm">
                          {task.lead && (
                            <Badge variant="outline">{task.lead.companyName}</Badge>
                          )}
                          {task.deal && (
                            <Badge variant="outline">{task.deal.title}</Badge>
                          )}
                          <Badge className={getPriorityColor(task.priority)}>
                            {task.priority}
                          </Badge>
                        </div>
                      </div>

                      {task.dueDate && (
                        <div className={`text-sm ${isOverdue(task.dueDate) ? 'text-red-500 font-semibold' : 'text-muted-foreground'}`}>
                          {isOverdue(task.dueDate) && <AlertCircle className="h-4 w-4 inline mr-1" />}
                          {format(new Date(task.dueDate), 'MMM dd, yyyy')}
                        </div>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0"
                        onClick={async () => {
                          if (
                            !(await confirmAction({
                              title: 'Delete this task?',
                              description: 'This cannot be undone.',
                              confirmLabel: 'Delete',
                              variant: 'destructive',
                            }))
                          )
                            return;
                          const res = await workspaceFetch(`/api/tasks/${task.id}`, {
                            method: 'DELETE',
                          });
                          if (!res.ok) {
                            toast.error('Failed to delete task');
                            return;
                          }
                          toast.success('Task deleted');
                          void fetchTasks();
                          void fetchStats();
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>Title *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Follow up with prospect"
              />
            </div>
            <div className="grid gap-2">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(type) => setForm((f) => ({ ...f, type }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODO">To-do</SelectItem>
                    <SelectItem value="CALL">Call</SelectItem>
                    <SelectItem value="EMAIL">Email</SelectItem>
                    <SelectItem value="MEETING">Meeting</SelectItem>
                    <SelectItem value="FOLLOW_UP">Follow up</SelectItem>
                    <SelectItem value="DEMO">Demo</SelectItem>
                    <SelectItem value="PROPOSAL">Proposal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Priority</Label>
                <Select
                  value={form.priority}
                  onValueChange={(priority) => setForm((f) => ({ ...f, priority }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="URGENT">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Due date</Label>
              <Input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void createTask()} disabled={creating}>
              {creating ? 'Creating…' : 'Create task'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) {
            setEditingTask(null);
            setForm(EMPTY_FORM);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>Title *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>Notes</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(type) => setForm((f) => ({ ...f, type }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODO">To-do</SelectItem>
                    <SelectItem value="CALL">Call</SelectItem>
                    <SelectItem value="EMAIL">Email</SelectItem>
                    <SelectItem value="MEETING">Meeting</SelectItem>
                    <SelectItem value="FOLLOW_UP">Follow up</SelectItem>
                    <SelectItem value="DEMO">Demo</SelectItem>
                    <SelectItem value="PROPOSAL">Proposal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Priority</Label>
                <Select
                  value={form.priority}
                  onValueChange={(priority) => setForm((f) => ({ ...f, priority }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="URGENT">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Due date</Label>
              <Input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            {editingTask && (
              <Button
                variant="destructive"
                className="mr-auto"
                onClick={() => void deleteTask(editingTask.id)}
              >
                Delete
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => {
                setEditOpen(false);
                setEditingTask(null);
                setForm(EMPTY_FORM);
              }}
            >
              Cancel
            </Button>
            <Button onClick={() => void saveTask()} disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
