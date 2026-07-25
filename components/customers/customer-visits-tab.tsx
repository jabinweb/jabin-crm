'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CalendarClock, Check, Pencil, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { EasyBottomSheet, EasyFab } from '@/components/customers/easy-bottom-sheet';
import { cn } from '@/lib/utils';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';

type Tag = { id: string; name: string; color?: string | null };
type Contact = { id: string; name: string };
type Department = { id: string; name: string };
type Visit = {
  id: string;
  scheduledAt: string;
  status: string;
  notes?: string | null;
  recurrenceRule?: string;
  recurrenceUntil?: string | null;
  department?: Department | null;
  assignedTechnician?: { id: string; name?: string | null } | null;
  tags?: Array<{ tag: Tag }>;
  contacts?: Array<{ contact: Contact }>;
};

function toLocalInputValue(iso?: string | null) {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toLocalDateValue(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatWhen(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return `Today · ${time}`;
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow =
    d.getFullYear() === tomorrow.getFullYear() &&
    d.getMonth() === tomorrow.getMonth() &&
    d.getDate() === tomorrow.getDate();
  if (isTomorrow) return `Tomorrow · ${time}`;
  return d.toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function CustomerVisitsTab({
  customerId,
  slug,
  visits,
  contacts,
  departments,
  workspaceFetch,
}: {
  customerId: string;
  slug?: string;
  visits: Visit[];
  contacts: Contact[];
  departments: Department[];
  workspaceFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}) {
  const { path } = useWorkspacePaths();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [scheduledAt, setScheduledAt] = useState(toLocalInputValue());
  const [notes, setNotes] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [technicianId, setTechnicianId] = useState('');
  const [recurrenceRule, setRecurrenceRule] = useState('NONE');
  const [recurrenceUntil, setRecurrenceUntil] = useState('');
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [contactIds, setContactIds] = useState<string[]>([]);

  const { data: tagsData, isLoading: tagsLoading } = useQuery({
    queryKey: ['visit-tags', slug],
    queryFn: async () => {
      const res = await workspaceFetch('/api/visit-tags');
      if (!res.ok) return { tags: [] as Tag[] };
      return res.json();
    },
  });

  const { data: techsData } = useQuery({
    queryKey: ['technicians', slug],
    queryFn: async () => {
      const res = await workspaceFetch('/api/users/technicians');
      if (!res.ok) return [];
      return res.json();
    },
  });

  const tags: Tag[] = tagsData?.tags || [];
  const technicians: Array<{ id: string; name?: string | null }> = Array.isArray(techsData)
    ? techsData
    : [];

  const upcoming = useMemo(
    () =>
      [...(visits || [])]
        .filter((v) => v.status === 'SCHEDULED')
        .sort(
          (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
        ),
    [visits]
  );

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['customer', slug, customerId] });

  const toggleId = (list: string[], id: string) =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

  const resetForm = () => {
    setEditingId(null);
    setScheduledAt(toLocalInputValue());
    setNotes('');
    setDepartmentId('');
    setTechnicianId('');
    setRecurrenceRule('NONE');
    setRecurrenceUntil('');
    setTagIds([]);
    setContactIds([]);
    setStep(1);
  };

  const openCreate = () => {
    resetForm();
    setOpen(true);
  };

  const openEdit = (visit: Visit) => {
    setEditingId(visit.id);
    setScheduledAt(toLocalInputValue(visit.scheduledAt));
    setNotes(visit.notes || '');
    setDepartmentId(visit.department?.id || '');
    setTechnicianId(visit.assignedTechnician?.id || '');
    setRecurrenceRule(visit.recurrenceRule || 'NONE');
    setRecurrenceUntil(toLocalDateValue(visit.recurrenceUntil));
    setTagIds(visit.tags?.map((t) => t.tag.id) || []);
    setContactIds(visit.contacts?.map((c) => c.contact.id) || []);
    setStep(1);
    setOpen(true);
  };

  const saveVisit = async () => {
    if (!scheduledAt) {
      toast.error('Pick a date & time');
      return;
    }
    setBusy(true);
    try {
      const payload = {
        scheduledAt: new Date(scheduledAt).toISOString(),
        notes: notes.trim() || null,
        departmentId: departmentId || null,
        assignedTechnicianId: technicianId || null,
        recurrenceRule,
        recurrenceUntil:
          recurrenceRule !== 'NONE' && recurrenceUntil
            ? new Date(`${recurrenceUntil}T23:59:59`).toISOString()
            : null,
        tagIds,
        contactIds,
      };
      const res = await workspaceFetch(
        editingId
          ? `/api/customers/${customerId}/visits/${editingId}`
          : `/api/customers/${customerId}/visits`,
        {
          method: editingId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Could not save visit');
      toast.success(editingId ? 'Visit updated' : 'Visit scheduled');
      setOpen(false);
      resetForm();
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (visitId: string, status: string) => {
    try {
      const res = await workspaceFetch(`/api/customers/${customerId}/visits/${visitId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success(status === 'COMPLETED' ? 'Done ✓' : 'Cancelled');
      invalidate();
    } catch {
      toast.error('Could not update');
    }
  };

  const deleteVisit = async (visitId: string) => {
    if (!window.confirm('Delete this visit?')) return;
    try {
      const res = await workspaceFetch(`/api/customers/${customerId}/visits/${visitId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed');
      toast.success('Visit deleted');
      invalidate();
    } catch {
      toast.error('Could not delete');
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-lg font-semibold tracking-tight">Visits</h3>
        <p className="text-sm text-muted-foreground">
          Demos, follow-ups, recurring site visits.
        </p>
      </div>

      {upcoming[0] ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 dark:bg-emerald-950/20 dark:border-emerald-900">
          <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200 text-xs font-semibold uppercase tracking-wide">
            <CalendarClock className="h-3.5 w-3.5" />
            Next up
          </div>
          <p className="mt-1 text-lg font-semibold">{formatWhen(upcoming[0].scheduledAt)}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {upcoming[0].tags?.map((t) => (
              <Badge
                key={t.tag.id}
                className="border-0"
                style={
                  t.tag.color
                    ? { backgroundColor: t.tag.color, color: '#fff' }
                    : undefined
                }
              >
                {t.tag.name}
              </Badge>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button
              className="h-11"
              onClick={() => setStatus(upcoming[0].id, 'COMPLETED')}
            >
              <Check className="mr-1.5 h-4 w-4" />
              Done
            </Button>
            <Button
              variant="outline"
              className="h-11"
              onClick={() => setStatus(upcoming[0].id, 'CANCELLED')}
            >
              <X className="mr-1.5 h-4 w-4" />
              Cancel
            </Button>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              className="h-10"
              onClick={() => openEdit(upcoming[0])}
            >
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Edit
            </Button>
            <Button
              variant="ghost"
              className="h-10 text-destructive"
              onClick={() => void deleteVisit(upcoming[0].id)}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Delete
            </Button>
          </div>
        </div>
      ) : null}

      {!visits?.length ? (
        <div className="rounded-2xl border border-dashed px-4 py-10 text-center">
          <CalendarClock className="mx-auto mb-3 h-10 w-10 text-muted-foreground/60" />
          <p className="font-medium">No visits yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Schedule a demo or follow-up in seconds.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {visits.map((v) => (
            <li key={v.id} className="rounded-2xl border bg-card p-3.5 space-y-2.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-semibold text-base">{formatWhen(v.scheduledAt)}</span>
                <Badge
                  variant={v.status === 'SCHEDULED' ? 'outline' : 'secondary'}
                  className="text-[10px]"
                >
                  {v.status === 'SCHEDULED' ? 'Upcoming' : v.status}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-1">
                {v.tags?.map((t) => (
                  <Badge
                    key={t.tag.id}
                    variant="secondary"
                    className="font-normal"
                    style={
                      t.tag.color
                        ? { backgroundColor: t.tag.color, color: '#fff' }
                        : undefined
                    }
                  >
                    {t.tag.name}
                  </Badge>
                ))}
                {v.recurrenceRule && v.recurrenceRule !== 'NONE' ? (
                  <Badge variant="outline" className="font-normal">
                    {v.recurrenceRule === 'WEEKLY' ? 'Weekly' : 'Monthly'}
                    {v.recurrenceUntil
                      ? ` · until ${new Date(v.recurrenceUntil).toLocaleDateString()}`
                      : ''}
                  </Badge>
                ) : null}
              </div>
              <p className="text-sm text-muted-foreground">
                {[
                  v.department?.name,
                  v.assignedTechnician?.name,
                  v.contacts?.length
                    ? v.contacts.map((c) => c.contact.name).join(', ')
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || (v.notes ? null : 'No extras')}
              </p>
              {v.notes ? <p className="text-sm">{v.notes}</p> : null}
              {v.status === 'SCHEDULED' ? (
                <div className="grid grid-cols-2 gap-2 pt-1 sm:grid-cols-4">
                  {upcoming[0]?.id !== v.id ? (
                    <>
                      <Button
                        variant="secondary"
                        className="h-11"
                        onClick={() => setStatus(v.id, 'COMPLETED')}
                      >
                        Done
                      </Button>
                      <Button
                        variant="outline"
                        className="h-11"
                        onClick={() => setStatus(v.id, 'CANCELLED')}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : null}
                  <Button
                    variant="outline"
                    className="h-11"
                    onClick={() => openEdit(v)}
                  >
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    className="h-11 text-destructive"
                    onClick={() => void deleteVisit(v.id)}
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    Delete
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" className="h-10" onClick={() => openEdit(v)}>
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    className="h-10 text-destructive"
                    onClick={() => void deleteVisit(v.id)}
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    Delete
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <EasyFab label="+ Schedule visit" onClick={openCreate} />

      <EasyBottomSheet
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) resetForm();
        }}
        title={editingId ? 'Edit visit' : 'Schedule visit'}
        description={step === 1 ? 'When & what kind?' : 'Who & extras (optional)'}
        footer={
          step === 1 ? (
            <Button
              size="lg"
              className="h-12 w-full text-base font-semibold"
              onClick={() => {
                if (!scheduledAt) {
                  toast.error('Pick a date & time');
                  return;
                }
                setStep(2);
              }}
            >
              Next
            </Button>
          ) : (
            <div className="grid grid-cols-2 gap-2 w-full">
              <Button
                size="lg"
                variant="outline"
                className="h-12 text-base"
                onClick={() => setStep(1)}
              >
                Back
              </Button>
              <Button
                size="lg"
                className="h-12 text-base font-semibold"
                onClick={() => void saveVisit()}
                disabled={busy}
              >
                {busy ? 'Saving…' : editingId ? 'Save' : 'Schedule'}
              </Button>
            </div>
          )
        }
      >
        {step === 1 ? (
          <div className="grid gap-4 pb-2">
            <div className="grid gap-2">
              <Label htmlFor="v-when">When *</Label>
              <Input
                id="v-when"
                type="datetime-local"
                className="h-12 text-base"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Type (tap to select)</Label>
              <div className="flex flex-wrap gap-2">
                {tagsLoading ? (
                  <p className="text-sm text-muted-foreground">Loading tags…</p>
                ) : tags.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No visit tags yet.{' '}
                    <Link
                      href={path('/dashboard/settings')}
                      className="underline underline-offset-2"
                    >
                      Add them under Settings → Business
                    </Link>
                    .
                  </p>
                ) : (
                  tags.map((t) => {
                    const on = tagIds.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTagIds(toggleId(tagIds, t.id))}
                        className={cn(
                          'min-h-11 rounded-full border px-4 text-sm font-medium transition-colors',
                          on
                            ? 'border-transparent text-white shadow-sm'
                            : 'bg-background text-foreground'
                        )}
                        style={
                          on && t.color
                            ? { backgroundColor: t.color }
                            : on
                              ? { backgroundColor: '#0f172a', color: '#fff' }
                              : undefined
                        }
                      >
                        {t.name}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Repeat</Label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    ['NONE', 'Once'],
                    ['WEEKLY', 'Weekly'],
                    ['MONTHLY', 'Monthly'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRecurrenceRule(value)}
                    className={cn(
                      'h-11 rounded-xl border text-sm font-medium',
                      recurrenceRule === value
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'bg-background'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {recurrenceRule !== 'NONE' ? (
              <div className="grid gap-2">
                <Label htmlFor="v-until">Repeat until (optional)</Label>
                <Input
                  id="v-until"
                  type="date"
                  className="h-12 text-base"
                  value={recurrenceUntil}
                  onChange={(e) => setRecurrenceUntil(e.target.value)}
                />
              </div>
            ) : null}
          </div>
        ) : (
          <div className="grid gap-4 pb-2">
            {departments.length > 0 ? (
              <div className="grid gap-2">
                <Label>Department</Label>
                <Select
                  value={departmentId || '__none__'}
                  onValueChange={(v) => setDepartmentId(v === '__none__' ? '' : v)}
                >
                  <SelectTrigger className="h-12 text-base">
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {contacts.length > 0 ? (
              <div className="grid gap-2">
                <Label>People you&apos;ll meet</Label>
                <div className="flex flex-wrap gap-2">
                  {contacts.map((c) => {
                    const on = contactIds.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setContactIds(toggleId(contactIds, c.id))}
                        className={cn(
                          'min-h-11 rounded-full border px-4 text-sm font-medium',
                          on
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'bg-background'
                        )}
                      >
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {technicians.length > 0 ? (
              <div className="grid gap-2">
                <Label>Technician</Label>
                <Select
                  value={technicianId || '__none__'}
                  onValueChange={(v) => setTechnicianId(v === '__none__' ? '' : v)}
                >
                  <SelectTrigger className="h-12 text-base">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Unassigned</SelectItem>
                    {technicians.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name || t.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="grid gap-2">
              <Label htmlFor="v-notes">Notes</Label>
              <Textarea
                id="v-notes"
                className="min-h-[88px] text-base"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>
        )}
      </EasyBottomSheet>
    </div>
  );
}
