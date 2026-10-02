'use client';

import { useEffect, useMemo, useState } from 'react';
import { addMinutes, format } from 'date-fns';
import { ExternalLink, MapPin, Plus, Repeat, Bell, Video, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserAvatar } from '@/components/ui/user-avatar';
import { PeoplePicker } from '@/components/messaging/people-picker';
import { displayName, usePeople } from '@/components/messaging/use-messaging';
import { useMeetingActions, useMeetingsNow } from '@/hooks/use-meetings';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  DEFAULT_REMINDER_MINUTES,
  MAX_OCCURRENCES,
  type MeetingProvider,
  type Recurrence,
} from '@/lib/meetings/rules';
import type { MeetingDTO } from '@/lib/meetings/types';

export type MeetingFieldsValue = {
  attendeeIds: string[];
  provider: MeetingProvider;
  meetingLink: string;
  recurrence: Recurrence;
  occurrences: number;
  reminderMinutes: string;
};

export function defaultMeetingFields(videoConfigured: boolean): MeetingFieldsValue {
  return {
    attendeeIds: [],
    provider: videoConfigured ? 'OPSLANE' : 'EXTERNAL',
    meetingLink: '',
    recurrence: 'NONE',
    occurrences: 4,
    reminderMinutes: String(DEFAULT_REMINDER_MINUTES),
  };
}

const REMINDERS = [
  { value: '0', label: 'No reminder' },
  { value: '5', label: '5 minutes before' },
  { value: '10', label: '10 minutes before' },
  { value: '15', label: '15 minutes before' },
  { value: '30', label: '30 minutes before' },
  { value: '60', label: '1 hour before' },
  { value: '1440', label: '1 day before' },
];

const REPEATS: Array<{ value: Recurrence; label: string }> = [
  { value: 'NONE', label: 'Does not repeat' },
  { value: 'DAILY', label: 'Every day' },
  { value: 'WEEKDAYS', label: 'Every weekday (Mon–Fri)' },
  { value: 'WEEKLY', label: 'Every week' },
];

/** Payload for POST/PATCH /api/meetings from the shared fields. */
export function meetingFieldsPayload(v: MeetingFieldsValue) {
  return {
    attendeeIds: v.attendeeIds,
    provider: v.provider,
    meetingLink: v.provider === 'EXTERNAL' ? v.meetingLink.trim() : undefined,
    recurrence: v.recurrence,
    occurrences: v.recurrence === 'NONE' ? 1 : v.occurrences,
    reminderMinutes: Number(v.reminderMinutes),
  };
}

/**
 * Team-meeting specific fields (guests, video, repeat, reminder) — used by the
 * Schedule meeting dialog and by the calendar's New event dialog when the type is Meeting.
 */
export function MeetingFields({
  value,
  onChange,
  videoConfigured,
  editing = false,
}: {
  value: MeetingFieldsValue;
  onChange: (next: MeetingFieldsValue) => void;
  videoConfigured: boolean;
  /** Editing an existing occurrence: repeat can't be changed */
  editing?: boolean;
}) {
  const { data: peopleData, isLoading: peopleLoading } = usePeople();
  const [picking, setPicking] = useState(false);
  const me = peopleData?.me;
  const people = useMemo(() => peopleData?.people ?? [], [peopleData?.people]);
  const selected = useMemo(
    () => value.attendeeIds.map((id) => people.find((p) => p.id === id)).filter(Boolean) as typeof people,
    [people, value.attendeeIds]
  );
  const set = (patch: Partial<MeetingFieldsValue>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-4">
      {/* Guests */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label>Guests</Label>
          <Button type="button" variant="ghost" size="sm" onClick={() => setPicking((p) => !p)}>
            {picking ? 'Done' : (
              <>
                <Plus className="h-3.5 w-3.5" /> Add teammates
              </>
            )}
          </Button>
        </div>
        {selected.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {selected.map((p) => (
              <span key={p.id} className="inline-flex max-w-full items-center gap-1.5 rounded-full border bg-muted/40 py-0.5 pl-0.5 pr-1.5 text-xs">
                <UserAvatar person={p} size="xs" />
                <span className="truncate">{displayName(p)}</span>
                <button
                  type="button"
                  aria-label={`Remove ${displayName(p)}`}
                  className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  onClick={() => set({ attendeeIds: value.attendeeIds.filter((id) => id !== p.id) })}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        ) : !picking ? (
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="w-full rounded-md border border-dashed px-3 py-2.5 text-left text-sm text-muted-foreground hover:bg-muted/40"
          >
            Invite teammates — they get a notification and the meeting lands on their calendar.
          </button>
        ) : null}
        {picking ? (
          peopleLoading ? (
            <p className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading teammates…
            </p>
          ) : (
            <PeoplePicker
              people={people}
              exclude={me ? [me] : []}
              selected={value.attendeeIds}
              onToggle={(id) =>
                set({
                  attendeeIds: value.attendeeIds.includes(id)
                    ? value.attendeeIds.filter((x) => x !== id)
                    : [...value.attendeeIds, id],
                })
              }
            />
          )
        ) : null}
      </div>

      {/* Where */}
      <div className="space-y-2">
        <Label>Video</Label>
        <div className="grid grid-cols-3 gap-1 rounded-lg border bg-muted/40 p-0.5" role="radiogroup" aria-label="Where the meeting happens">
          {(
            [
              { v: 'OPSLANE', label: 'Opslane video', icon: Video },
              { v: 'EXTERNAL', label: 'Meeting link', icon: ExternalLink },
              { v: 'NONE', label: 'In person', icon: MapPin },
            ] as const
          ).map((opt) => {
            const disabled = opt.v === 'OPSLANE' && !videoConfigured;
            const active = value.provider === opt.v;
            return (
              <button
                key={opt.v}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={disabled}
                title={disabled ? 'Built-in video is not set up for this workspace yet' : undefined}
                onClick={() => set({ provider: opt.v })}
                className={cn(
                  'flex min-w-0 items-center justify-center gap-1.5 rounded-md px-1.5 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm',
                  active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <opt.icon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{opt.label}</span>
              </button>
            );
          })}
        </div>
        {value.provider === 'OPSLANE' ? (
          <p className="text-xs text-muted-foreground">
            A private video room in Opslane — camera, mic, screen share and chat. Only guests can join.
          </p>
        ) : null}
        {value.provider === 'EXTERNAL' ? (
          <Input
            type="url"
            inputMode="url"
            value={value.meetingLink}
            onChange={(e) => set({ meetingLink: e.target.value })}
            placeholder="https://meet.google.com/… or https://zoom.us/j/…"
            required
          />
        ) : null}
        {!videoConfigured && value.provider !== 'OPSLANE' ? (
          <p className="text-xs text-muted-foreground">
            Built-in video rooms aren&apos;t set up for this workspace yet — paste a Google Meet or Zoom link.
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5">
            <Repeat className="h-3.5 w-3.5" /> Repeat
          </Label>
          <Select
            value={value.recurrence}
            onValueChange={(v) => set({ recurrence: v as Recurrence })}
            disabled={editing}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REPEATS.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {value.recurrence !== 'NONE' && !editing ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">for</span>
              <Input
                type="number"
                min={2}
                max={MAX_OCCURRENCES}
                value={value.occurrences}
                onChange={(e) =>
                  set({ occurrences: Math.max(2, Math.min(MAX_OCCURRENCES, Number(e.target.value) || 2)) })
                }
                className="h-8 w-20"
                aria-label="Number of meetings"
              />
              <span className="text-muted-foreground">meetings</span>
            </div>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5">
            <Bell className="h-3.5 w-3.5" /> Reminder
          </Label>
          <Select value={value.reminderMinutes} onValueChange={(v) => set({ reminderMinutes: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REMINDERS.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

const DURATIONS = [15, 30, 45, 60, 90, 120];

function nextHalfHour() {
  const d = new Date();
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60);
  return d;
}

/** Schedule (or edit) a team meeting. */
export function ScheduleMeetingDialog({
  open,
  onOpenChange,
  initial,
  meeting,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: { start?: Date; end?: Date; title?: string; attendeeIds?: string[] };
  /** Edit mode */
  meeting?: MeetingDTO | null;
  onSaved?: (meeting: MeetingDTO, count: number) => void;
}) {
  const { toast } = useToast();
  const { data: now } = useMeetingsNow();
  const videoConfigured = !!now?.video.configured;
  const { create, update } = useMeetingActions();
  const [title, setTitle] = useState('');
  const [agenda, setAgenda] = useState('');
  const [location, setLocation] = useState('');
  const [start, setStart] = useState('');
  const [duration, setDuration] = useState('30');
  const [fields, setFields] = useState<MeetingFieldsValue>(() => defaultMeetingFields(videoConfigured));

  // Reset the form each time the dialog opens
  useEffect(() => {
    if (!open) return;
    if (meeting) {
      const s = new Date(meeting.startTime);
      setTitle(meeting.title);
      setAgenda(meeting.agenda ?? '');
      setLocation(meeting.location ?? '');
      setStart(format(s, "yyyy-MM-dd'T'HH:mm"));
      setDuration(String(Math.max(5, Math.round((new Date(meeting.endTime).getTime() - s.getTime()) / 60_000))));
      setFields({
        attendeeIds: meeting.attendees.filter((a) => a.role !== 'ORGANIZER').map((a) => a.user.id),
        provider: meeting.provider,
        meetingLink: meeting.meetingLink ?? '',
        recurrence: meeting.recurrence,
        occurrences: 1,
        reminderMinutes: String(meeting.reminderMinutes ?? DEFAULT_REMINDER_MINUTES),
      });
      return;
    }
    const s = initial?.start ?? nextHalfHour();
    const minutes = initial?.end ? Math.round((initial.end.getTime() - s.getTime()) / 60_000) : 30;
    setTitle(initial?.title ?? '');
    setAgenda('');
    setLocation('');
    setStart(format(s, "yyyy-MM-dd'T'HH:mm"));
    setDuration(String(minutes > 0 && minutes <= 24 * 60 ? minutes : 30));
    setFields({ ...defaultMeetingFields(videoConfigured), attendeeIds: initial?.attendeeIds ?? [] });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when (re)opened
  }, [open]);

  const durationOptions = DURATIONS.includes(Number(duration)) ? DURATIONS : [...DURATIONS, Number(duration)].sort((a, b) => a - b);
  const saving = create.isPending || update.isPending;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const s = new Date(start);
    if (Number.isNaN(s.getTime())) return;
    const body = {
      title,
      agenda,
      location,
      startTime: s.toISOString(),
      endTime: addMinutes(s, Number(duration)).toISOString(),
      ...meetingFieldsPayload(fields),
    };
    const onError = (error: Error) =>
      toast({ title: meeting ? 'Could not save changes' : 'Could not schedule the meeting', description: error.message, variant: 'destructive' });
    if (meeting) {
      const { recurrence: _r, occurrences: _o, ...patch } = body;
      update.mutate(
        { id: meeting.id, ...patch },
        {
          onSuccess: (data) => {
            toast({ title: 'Meeting updated', description: 'Guests were notified of the changes.' });
            onOpenChange(false);
            onSaved?.(data.meeting, 1);
          },
          onError,
        }
      );
      return;
    }
    create.mutate(body, {
      onSuccess: (data) => {
        const guests = fields.attendeeIds.length;
        toast({
          title: data.count > 1 ? `${data.count} meetings scheduled` : 'Meeting scheduled',
          description: guests ? `Invitations sent to ${guests} ${guests === 1 ? 'person' : 'people'}.` : 'It’s on your calendar.',
        });
        onOpenChange(false);
        onSaved?.(data.meeting, data.count);
      },
      onError,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{meeting ? 'Edit meeting' : 'Schedule a team meeting'}</DialogTitle>
          <DialogDescription>
            {meeting
              ? 'Guests are told about changes. Moving the time asks everyone to reply again.'
              : 'Pick teammates and a time. Everyone gets an invite with Accept / Decline and a reminder before it starts.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="meeting-title">Title</Label>
            <Input
              id="meeting-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Weekly sync"
              required
              maxLength={200}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_10rem]">
            <div className="space-y-2">
              <Label htmlFor="meeting-start">Starts</Label>
              <Input id="meeting-start" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Duration</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {durationOptions.map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {m < 60 ? `${m} min` : m % 60 === 0 ? `${m / 60} h` : `${Math.floor(m / 60)} h ${m % 60} min`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <MeetingFields value={fields} onChange={setFields} videoConfigured={videoConfigured || meeting?.provider === 'OPSLANE'} editing={!!meeting} />
          {fields.provider === 'NONE' ? (
            <div className="space-y-2">
              <Label htmlFor="meeting-location">Location</Label>
              <Input id="meeting-location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Conference room, office…" />
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="meeting-agenda">Agenda</Label>
            <Textarea
              id="meeting-agenda"
              value={agenda}
              onChange={(e) => setAgenda(e.target.value)}
              placeholder="What do you want to cover?"
              rows={3}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {meeting ? 'Save changes' : fields.attendeeIds.length ? 'Send invites' : 'Schedule'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
