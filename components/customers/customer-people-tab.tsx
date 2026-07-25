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
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

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
  title: '',
  specialty: '',
  email: '',
  phone: '',
  departmentId: '',
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
  const [form, setForm] = useState(emptyForm);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['customer', slug, customerId] });

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (c: Contact) => {
    setEditingId(c.id);
    setForm({
      name: c.name || '',
      role: c.role || '',
      title: c.title || '',
      specialty: c.specialty || '',
      email: c.email || '',
      phone: c.phone || '',
      departmentId: c.departmentId || '',
      isPrimary: !!c.isPrimary,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error('Contact name is required');
      return;
    }
    setBusy(true);
    try {
      const payload = {
        name: form.name.trim(),
        role: form.role.trim() || null,
        title: form.title.trim() || null,
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
        throw new Error(body.error || 'Failed to save contact');
      }
      toast.success(editingId ? 'Contact updated' : 'Contact added');
      setOpen(false);
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save contact');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (contactId: string) => {
    if (!confirm('Remove this contact?')) return;
    try {
      const res = await workspaceFetch(
        `/api/customers/${customerId}/contacts/${contactId}`,
        { method: 'DELETE' }
      );
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Contact removed');
      invalidate();
    } catch {
      toast.error('Failed to remove contact');
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>People</CardTitle>
          <CardDescription>
            Doctors, HODs, and other contacts at this client. Optionally link them to a department.
          </CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Add contact
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit contact' : 'Add contact'}</DialogTitle>
              <DialogDescription>
                Store people technicians meet on visits (doctors, nurses, admins).
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label>Full name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Dr. Priya Sharma"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Role</Label>
                  <Input
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                    placeholder="Doctor / HOD / Nurse"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Title</Label>
                  <Input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="Consultant"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Specialty</Label>
                <Input
                  value={form.specialty}
                  onChange={(e) => setForm({ ...form, specialty: e.target.value })}
                  placeholder="Cardiology"
                />
              </div>
              <div className="grid gap-2">
                <Label>Department</Label>
                <Select
                  value={form.departmentId || '__none__'}
                  onValueChange={(v) =>
                    setForm({ ...form, departmentId: v === '__none__' ? '' : v })
                  }
                >
                  <SelectTrigger>
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
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Phone</Label>
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <Label htmlFor="primary-contact">Primary contact</Label>
                <Switch
                  id="primary-contact"
                  checked={form.isPrimary}
                  onCheckedChange={(v) => setForm({ ...form, isPrimary: v })}
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
        {!contacts?.length ? (
          <p className="text-sm text-muted-foreground py-4 italic">
            No contacts yet. Add doctors or staff who visits should reference.
          </p>
        ) : (
          <div className="space-y-3">
            {contacts.map((c) => (
              <div
                key={c.id}
                className="flex items-start justify-between gap-3 rounded-lg border p-3"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{c.name}</p>
                    {c.isPrimary ? <Badge variant="secondary">Primary</Badge> : null}
                    {c.department?.name ? (
                      <Badge variant="outline">{c.department.name}</Badge>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {[c.role, c.title, c.specialty].filter(Boolean).join(' · ') || 'No role set'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {[c.email, c.phone].filter(Boolean).join(' · ') || 'No contact info'}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(c)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(c.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
