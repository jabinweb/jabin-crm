'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, CheckCircle2, XCircle, CalendarClock } from 'lucide-react';
import { toast } from 'sonner';

type Tag = { id: string; name: string; color?: string | null };
type Contact = { id: string; name: string };
type Department = { id: string; name: string };
type Visit = {
  id: string;
  scheduledAt: string;
  status: string;
  notes?: string | null;
  recurrenceRule?: string;
  department?: Department | null;
  assignedTechnician?: { id: string; name?: string | null } | null;
  tags?: Array<{ tag: Tag }>;
  contacts?: Array<{ contact: Contact }>;
};

function toLocalInputValue(iso?: string) {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [scheduledAt, setScheduledAt] = useState(toLocalInputValue());
  const [notes, setNotes] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [technicianId, setTechnicianId] = useState('');
  const [recurrenceRule, setRecurrenceRule] = useState('NONE');
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [contactIds, setContactIds] = useState<string[]>([]);

  const { data: tagsData } = useQuery({
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
    : techsData?.users || techsData?.technicians || [];

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

  const toggleId = (list: string[], id: string, on: boolean) =>
    on ? Array.from(new Set([...list, id])) : list.filter((x) => x !== id);

  const createVisit = async () => {
    if (!scheduledAt) {
      toast.error('Schedule date/time is required');
      return;
    }
    setBusy(true);
    try {
      const res = await workspaceFetch(`/api/customers/${customerId}/visits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduledAt: new Date(scheduledAt).toISOString(),
          notes: notes.trim() || null,
          departmentId: departmentId || null,
          assignedTechnicianId: technicianId || null,
          recurrenceRule,
          tagIds,
          contactIds,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Failed to create visit');
      toast.success('Visit scheduled');
      setOpen(false);
      setNotes('');
      setTagIds([]);
      setContactIds([]);
      setRecurrenceRule('NONE');
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create visit');
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
      toast.success(
        status === 'COMPLETED'
          ? 'Visit completed'
          : status === 'CANCELLED'
            ? 'Visit cancelled'
            : 'Visit updated'
      );
      invalidate();
    } catch {
      toast.error('Could not update visit');
    }
  };

  return (
    <div className="space-y-6">
      {upcoming[0] ? (
        <Card className="border-emerald-200 bg-emerald-50/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarClock className="h-4 w-4" />
              Next visit
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <p className="font-medium">
              {new Date(upcoming[0].scheduledAt).toLocaleString()}
            </p>
            <div className="flex flex-wrap gap-1">
              {upcoming[0].tags?.map((t) => (
                <Badge
                  key={t.tag.id}
                  style={t.tag.color ? { backgroundColor: t.tag.color, color: '#fff' } : undefined}
                >
                  {t.tag.name}
                </Badge>
              ))}
            </div>
            {upcoming[0].department?.name ? (
              <p className="text-muted-foreground">{upcoming[0].department.name}</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Visits</CardTitle>
            <CardDescription>
              Demos, scheduled visits, follow-ups, and recurring technician visits — separate from
              support tickets.
            </CardDescription>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                onClick={() => {
                  setScheduledAt(toLocalInputValue());
                  setOpen(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Schedule visit
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Schedule visit</DialogTitle>
                <DialogDescription>
                  Tag the visit type, who you will meet, and optional recurrence.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="grid gap-2">
                  <Label>When</Label>
                  <Input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Visit tags</Label>
                  <div className="grid gap-2 rounded-md border p-3 max-h-40 overflow-y-auto">
                    {tags.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No tags yet — they seed automatically, or add some in Company settings.
                      </p>
                    ) : (
                      tags.map((t) => (
                        <label key={t.id} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={tagIds.includes(t.id)}
                            onCheckedChange={(v) =>
                              setTagIds(toggleId(tagIds, t.id, v === true))
                            }
                          />
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: t.color || '#64748b' }}
                          />
                          {t.name}
                        </label>
                      ))
                    )}
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Department</Label>
                  <Select
                    value={departmentId || '__none__'}
                    onValueChange={(v) => setDepartmentId(v === '__none__' ? '' : v)}
                  >
                    <SelectTrigger>
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
                <div className="grid gap-2">
                  <Label>People met</Label>
                  <div className="grid gap-2 rounded-md border p-3 max-h-36 overflow-y-auto">
                    {!contacts.length ? (
                      <p className="text-xs text-muted-foreground">Add contacts in the People tab.</p>
                    ) : (
                      contacts.map((c) => (
                        <label key={c.id} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={contactIds.includes(c.id)}
                            onCheckedChange={(v) =>
                              setContactIds(toggleId(contactIds, c.id, v === true))
                            }
                          />
                          {c.name}
                        </label>
                      ))
                    )}
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Technician</Label>
                  <Select
                    value={technicianId || '__none__'}
                    onValueChange={(v) => setTechnicianId(v === '__none__' ? '' : v)}
                  >
                    <SelectTrigger>
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
                <div className="grid gap-2">
                  <Label>Recurrence</Label>
                  <Select value={recurrenceRule} onValueChange={setRecurrenceRule}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">One-time</SelectItem>
                      <SelectItem value="WEEKLY">Weekly</SelectItem>
                      <SelectItem value="MONTHLY">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Completing a recurring visit schedules the next occurrence automatically.
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="Demo scope, night access, etc."
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={createVisit} disabled={busy}>
                  {busy ? 'Saving…' : 'Schedule'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {!visits?.length ? (
            <p className="text-sm text-muted-foreground py-4 italic">
              No visits yet. Schedule a demo, follow-up, or recurring site visit.
            </p>
          ) : (
            <div className="space-y-3">
              {visits.map((v) => (
                <div key={v.id} className="rounded-lg border p-4 space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1">
                      <p className="font-medium">
                        {new Date(v.scheduledAt).toLocaleString()}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        <Badge
                          variant={
                            v.status === 'COMPLETED'
                              ? 'default'
                              : v.status === 'CANCELLED' || v.status === 'NO_SHOW'
                                ? 'secondary'
                                : 'outline'
                          }
                        >
                          {v.status}
                        </Badge>
                        {v.recurrenceRule && v.recurrenceRule !== 'NONE' ? (
                          <Badge variant="outline">{v.recurrenceRule}</Badge>
                        ) : null}
                        {v.tags?.map((t) => (
                          <Badge
                            key={t.tag.id}
                            variant="secondary"
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
                    </div>
                    {v.status === 'SCHEDULED' ? (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setStatus(v.id, 'COMPLETED')}
                        >
                          <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                          Complete
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setStatus(v.id, 'CANCELLED')}
                        >
                          <XCircle className="mr-1 h-3.5 w-3.5" />
                          Cancel
                        </Button>
                      </div>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {[
                      v.department?.name,
                      v.assignedTechnician?.name
                        ? `Tech: ${v.assignedTechnician.name}`
                        : null,
                      v.contacts?.length
                        ? `Met: ${v.contacts.map((c) => c.contact.name).join(', ')}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'No department / people linked'}
                  </p>
                  {v.notes ? <p className="text-sm">{v.notes}</p> : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
