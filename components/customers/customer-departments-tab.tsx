'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Pencil, Trash2, Building2 } from 'lucide-react';
import { toast } from 'sonner';

type Contact = { id: string; name: string; role?: string | null; specialty?: string | null };
type Department = {
  id: string;
  name: string;
  notes?: string | null;
  contacts?: Contact[];
  _count?: { contacts: number; visits: number };
};

export function CustomerDepartmentsTab({
  customerId,
  slug,
  departments,
  workspaceFetch,
}: {
  customerId: string;
  slug?: string;
  departments: Department[];
  workspaceFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['customer', slug, customerId] });

  const openCreate = () => {
    setEditingId(null);
    setName('');
    setNotes('');
    setOpen(true);
  };

  const openEdit = (d: Department) => {
    setEditingId(d.id);
    setName(d.name);
    setNotes(d.notes || '');
    setOpen(true);
  };

  const save = async () => {
    if (!name.trim()) {
      toast.error('Department name is required');
      return;
    }
    setBusy(true);
    try {
      const res = await workspaceFetch(
        editingId
          ? `/api/customers/${customerId}/departments/${editingId}`
          : `/api/customers/${customerId}/departments`,
        {
          method: editingId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), notes: notes.trim() || null }),
        }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Failed to save department');
      toast.success(editingId ? 'Department updated' : 'Department added');
      setOpen(false);
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (deptId: string) => {
    if (!confirm('Delete this department? Contacts will be unlinked, not deleted.')) return;
    try {
      const res = await workspaceFetch(
        `/api/customers/${customerId}/departments/${deptId}`,
        { method: 'DELETE' }
      );
      if (!res.ok) throw new Error('Failed');
      toast.success('Department removed');
      invalidate();
    } catch {
      toast.error('Failed to remove department');
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Departments</CardTitle>
          <CardDescription>
            Optional — for hospitals and multi-unit sites (Cardiology, ICU, Night OT, etc.).
          </CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Add department
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit department' : 'Add department'}</DialogTitle>
              <DialogDescription>
                Group doctors and staff technicians meet during visits.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label>Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Cardiology"
                />
              </div>
              <div className="grid gap-2">
                <Label>Notes</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Wing, floor, night coverage…"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={save} disabled={busy}>
                {busy ? 'Saving…' : 'Save'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {!departments?.length ? (
          <div className="rounded-lg border border-dashed p-8 text-center space-y-2">
            <Building2 className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">No departments yet</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Skip this for small clinics. For hospitals, add units so visits can target the right
              doctors and night teams.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {departments.map((d) => (
              <div key={d.id} className="rounded-lg border p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">{d.name}</h4>
                      <Badge variant="secondary">
                        {d._count?.contacts ?? d.contacts?.length ?? 0} people
                      </Badge>
                    </div>
                    {d.notes ? (
                      <p className="text-sm text-muted-foreground mt-1">{d.notes}</p>
                    ) : null}
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(d)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(d.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {d.contacts?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {d.contacts.map((c) => (
                      <Badge key={c.id} variant="outline" className="font-normal">
                        {c.name}
                        {c.role ? ` · ${c.role}` : ''}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    No contacts linked — assign people from the People tab.
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
