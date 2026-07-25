'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Building2, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { EasyBottomSheet, EasyFab } from '@/components/customers/easy-bottom-sheet';

type Contact = { id: string; name: string; role?: string | null };
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
      toast.error('Name is required');
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
      if (!res.ok) throw new Error(body.error || 'Could not save');
      toast.success(editingId ? 'Saved' : 'Department added');
      setOpen(false);
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (deptId: string, deptName: string) => {
    if (!confirm(`Delete ${deptName}? People stay — they just unlink.`)) return;
    try {
      const res = await workspaceFetch(
        `/api/customers/${customerId}/departments/${deptId}`,
        { method: 'DELETE' }
      );
      if (!res.ok) throw new Error('Failed');
      toast.success('Removed');
      invalidate();
    } catch {
      toast.error('Could not remove');
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-lg font-semibold tracking-tight">Departments</h3>
        <p className="text-sm text-muted-foreground">
          Optional — Cardiology, ICU, Night OT…
        </p>
      </div>

      {!departments?.length ? (
        <div className="rounded-2xl border border-dashed px-4 py-10 text-center">
          <Building2 className="mx-auto mb-3 h-10 w-10 text-muted-foreground/60" />
          <p className="font-medium">Skip if not needed</p>
          <p className="mt-1 text-sm text-muted-foreground max-w-xs mx-auto">
            Small clinics can ignore this. Hospitals add units so visits hit the right team.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {departments.map((d) => (
            <li key={d.id} className="rounded-2xl border bg-card p-3.5 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => openEdit(d)}
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold text-base">{d.name}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {d._count?.contacts ?? d.contacts?.length ?? 0} people
                    </Badge>
                  </div>
                  {d.notes ? (
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{d.notes}</p>
                  ) : null}
                </button>
                <div className="flex shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-11 w-11"
                    onClick={() => openEdit(d)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-11 w-11 text-destructive"
                    onClick={() => remove(d.id, d.name)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {d.contacts?.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {d.contacts.map((c) => (
                    <Badge key={c.id} variant="outline" className="font-normal">
                      {c.name}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Link people from the People tab.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <EasyFab label="+ Add department" onClick={openCreate} />

      <EasyBottomSheet
        open={open}
        onOpenChange={setOpen}
        title={editingId ? 'Edit department' : 'Add department'}
        description="Name only — notes are optional."
        footer={
          <Button
            size="lg"
            className="h-12 w-full text-base font-semibold"
            onClick={save}
            disabled={busy}
          >
            {busy ? 'Saving…' : 'Save'}
          </Button>
        }
      >
        <div className="grid gap-4 pb-2">
          <div className="grid gap-2">
            <Label htmlFor="d-name">Name *</Label>
            <Input
              id="d-name"
              className="h-12 text-base"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Cardiology"
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="d-notes">Notes</Label>
            <Textarea
              id="d-notes"
              className="min-h-[88px] text-base"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Floor, wing, night coverage…"
            />
          </div>
        </div>
      </EasyBottomSheet>
    </div>
  );
}
