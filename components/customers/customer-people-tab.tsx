'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Mail, Phone, Pencil, Trash2, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { EasyBottomSheet, EasyFab } from '@/components/customers/easy-bottom-sheet';

type Department = { id: string; name: string };
type Contact = {
  id: string;
  name: string;
  role?: string | null;
  title?: string | null;
  specialty?: string | null;
  email?: string | null;
  phone?: string | null;
  isPrimary?: boolean;
  departmentId?: string | null;
  department?: Department | null;
};

const emptyForm = {
  name: '',
  role: '',
  email: '',
  phone: '',
  departmentId: '',
  specialty: '',
  isPrimary: false,
};

export function CustomerPeopleTab({
  customerId,
  slug,
  contacts,
  departments,
  workspaceFetch,
}: {
  customerId: string;
  slug?: string;
  contacts: Contact[];
  departments: Department[];
  workspaceFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['customer', slug, customerId] });

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowMore(false);
    setOpen(true);
  };

  const openEdit = (c: Contact) => {
    setEditingId(c.id);
    setForm({
      name: c.name || '',
      role: c.role || '',
      specialty: c.specialty || '',
      email: c.email || '',
      phone: c.phone || '',
      departmentId: c.departmentId || '',
      isPrimary: !!c.isPrimary,
    });
    setShowMore(!!(c.specialty || c.departmentId || c.isPrimary));
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error('Name is required');
      return;
    }
    setBusy(true);
    try {
      const payload = {
        name: form.name.trim(),
        role: form.role.trim() || null,
        specialty: form.specialty.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        departmentId: form.departmentId || null,
        isPrimary: form.isPrimary,
      };
      const res = await workspaceFetch(
        editingId
          ? `/api/customers/${customerId}/contacts/${editingId}`
          : `/api/customers/${customerId}/contacts`,
        {
          method: editingId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Could not save');
      }
      toast.success(editingId ? 'Saved' : 'Contact added');
      setOpen(false);
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (contactId: string, name: string) => {
    if (!confirm(`Remove ${name}?`)) return;
    try {
      const res = await workspaceFetch(
        `/api/customers/${customerId}/contacts/${contactId}`,
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
        <h3 className="text-lg font-semibold tracking-tight">People</h3>
        <p className="text-sm text-muted-foreground">
          Doctors and staff you meet on visits.
        </p>
      </div>

      {!contacts?.length ? (
        <div className="rounded-2xl border border-dashed px-4 py-10 text-center">
          <UserRound className="mx-auto mb-3 h-10 w-10 text-muted-foreground/60" />
          <p className="font-medium">No people yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add a doctor or contact in one tap.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {contacts.map((c) => (
            <li
              key={c.id}
              className="rounded-2xl border bg-card p-3.5 active:bg-muted/40"
            >
              <div className="flex items-start justify-between gap-2">
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => openEdit(c)}
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold text-base leading-tight">{c.name}</span>
                    {c.isPrimary ? (
                      <Badge variant="secondary" className="text-[10px]">
                        Primary
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {[c.role, c.specialty, c.department?.name]
                      .filter(Boolean)
                      .join(' · ') || 'Tap to edit'}
                  </p>
                </button>
                <div className="flex shrink-0 gap-0.5">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-11 w-11"
                    onClick={() => openEdit(c)}
                    aria-label="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-11 w-11 text-destructive"
                    onClick={() => remove(c.id, c.name)}
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {(c.phone || c.email) && (
                <div className="mt-3 flex gap-2">
                  {c.phone ? (
                    <Button asChild variant="outline" size="sm" className="h-10 flex-1">
                      <a href={`tel:${c.phone}`}>
                        <Phone className="mr-1.5 h-3.5 w-3.5" />
                        Call
                      </a>
                    </Button>
                  ) : null}
                  {c.email ? (
                    <Button asChild variant="outline" size="sm" className="h-10 flex-1">
                      <a href={`mailto:${c.email}`}>
                        <Mail className="mr-1.5 h-3.5 w-3.5" />
                        Email
                      </a>
                    </Button>
                  ) : null}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <EasyFab label="+ Add person" onClick={openCreate} />

      <EasyBottomSheet
        open={open}
        onOpenChange={setOpen}
        title={editingId ? 'Edit person' : 'Add person'}
        description="Only name is required."
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
            <Label htmlFor="p-name">Name *</Label>
            <Input
              id="p-name"
              className="h-12 text-base"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Dr. Priya Sharma"
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="p-role">Role</Label>
            <Input
              id="p-role"
              className="h-12 text-base"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              placeholder="Doctor, HOD, Nurse…"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="p-phone">Phone</Label>
              <Input
                id="p-phone"
                type="tel"
                className="h-12 text-base"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                inputMode="tel"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="p-email">Email</Label>
              <Input
                id="p-email"
                type="email"
                className="h-12 text-base"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                inputMode="email"
              />
            </div>
          </div>

          <button
            type="button"
            className="text-sm font-medium text-primary text-left py-1"
            onClick={() => setShowMore((v) => !v)}
          >
            {showMore ? 'Hide extra fields' : 'More options'}
          </button>

          {showMore ? (
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label>Department</Label>
                <Select
                  value={form.departmentId || '__none__'}
                  onValueChange={(v) =>
                    setForm({ ...form, departmentId: v === '__none__' ? '' : v })
                  }
                >
                  <SelectTrigger className="h-12 text-base">
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No department</SelectItem>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="p-specialty">Specialty</Label>
                <Input
                  id="p-specialty"
                  className="h-12 text-base"
                  value={form.specialty}
                  onChange={(e) => setForm({ ...form, specialty: e.target.value })}
                  placeholder="Cardiology"
                />
              </div>
              <div className="flex h-12 items-center justify-between rounded-xl border px-3">
                <Label htmlFor="p-primary" className="text-base">
                  Primary contact
                </Label>
                <Switch
                  id="p-primary"
                  checked={form.isPrimary}
                  onCheckedChange={(v) => setForm({ ...form, isPrimary: v })}
                />
              </div>
            </div>
          ) : null}
        </div>
      </EasyBottomSheet>
    </div>
  );
}
