'use client';

import { Suspense, useEffect, useState } from 'react';
import { Calendar, dateFnsLocalizer, View, type ToolbarProps } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, addMonths, subMonths } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { CalendarIcon, Clock, MapPin, Users, Link as LinkIcon, Plus, Trash2, Check, X, ChevronLeft, ChevronRight, Loader2, Video, Pencil, CalendarX } from 'lucide-react';
import { cn } from '@/lib/utils';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { useCurrency } from '@/hooks/use-currency';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { useFeatureModuleMap } from '@/components/feature-module-guard';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AvatarStack } from '@/components/ui/user-avatar';
import { useRealtime } from '@/hooks/use-realtime';
import { REALTIME_EVENTS } from '@/lib/realtime/events';
import { useMeetingActions, useMeetingsNow } from '@/hooks/use-meetings';
import { MeetingPhaseBadge, phaseOf } from '@/components/meetings/meeting-status';
import { AttendeeList, JoinButton, RsvpControl, RsvpSummaryText } from '@/components/meetings/meeting-parts';
import { MeetingNotesPreview } from '@/components/meetings/ai-notes/meeting-notes-preview';
import {
  MeetingFields,
  ScheduleMeetingDialog,
  defaultMeetingFields,
  meetingFieldsPayload,
  type MeetingFieldsValue,
} from '@/components/meetings/schedule-meeting-dialog';
import type { MeetingDTO } from '@/lib/meetings/types';

const locales = {
  'en-US': require('date-fns/locale/en-US'),
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  location?: string;
  eventType: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  attendees?: string[];
  meetingLink?: string;
  status: string;
  lead?: {
    id: string;
    companyName: string;
    contactName: string;
    email: string;
  };
  deal?: {
    id: string;
    title: string;
    value: number;
    stage: string;
  };
  /** Team meeting details (guests, RSVPs, room) when this event is a team meeting */
  meeting?: MeetingDTO;
  /** Someone else's meeting I'm invited to (not editable from here) */
  invited?: boolean;
}

/** Calendar chip: title, then guest avatars and a live dot for team meetings. */
function CalendarEventChip({ event }: { event: { title: string; resource: CalendarEvent } }) {
  const meeting = event.resource.meeting;
  if (!meeting) return <span className="truncate">{event.title}</span>;
  const phase = phaseOf(meeting, new Date());
  const going = meeting.attendees.filter((a) => a.rsvp !== 'DECLINED').map((a) => a.user);
  return (
    <span className="flex min-w-0 items-center gap-1">
      {phase === 'live' ? (
        <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-red-500 motion-reduce:animate-none" aria-label="Live now" />
      ) : (
        <Video className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
      )}
      <span className="min-w-0 flex-1 truncate">{event.title}</span>
      {going.length > 1 ? <AvatarStack people={going} max={3} size="xs" className="hidden shrink-0 sm:inline-flex" /> : null}
    </span>
  );
}

const EVENT_TYPES = [
  { value: 'MEETING', label: 'Meeting' },
  { value: 'CALL', label: 'Call' },
  { value: 'DEMO', label: 'Demo' },
  { value: 'FOLLOW_UP', label: 'Follow Up' },
  { value: 'PRESENTATION', label: 'Presentation' },
  { value: 'NEGOTIATION', label: 'Negotiation' },
  { value: 'CLOSING', label: 'Closing' },
  { value: 'OTHER', label: 'Other' },
];

/** Event chip colours (inline, so they never depend on generated class names). */
const EVENT_TYPE_HEX: Record<string, string> = {
  MEETING: '#3b82f6',
  CALL: '#10b981',
  DEMO: '#8b5cf6',
  FOLLOW_UP: '#f59e0b',
  PRESENTATION: '#ec4899',
  NEGOTIATION: '#f97316',
  CLOSING: '#ef4444',
  OTHER: '#64748b',
};

const VIEWS: Array<{ value: View; label: string }> = [
  { value: 'month', label: 'Month' },
  { value: 'week', label: 'Week' },
  { value: 'day', label: 'Day' },
  { value: 'agenda', label: 'Agenda' },
];

/** Google-Calendar-style header: Today, arrows, period title, one view switcher. */
function CalendarToolbar({ label, view, onNavigate, onView, loading }: ToolbarProps & { loading?: boolean }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" className="h-9" onClick={() => onNavigate('TODAY')}>
        Today
      </Button>
      <div className="flex items-center">
        <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Previous" onClick={() => onNavigate('PREV')}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Next" onClick={() => onNavigate('NEXT')}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <h2 className="min-w-0 flex-1 truncate text-lg font-semibold tracking-tight">{label}</h2>
      {loading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Loading events" /> : null}
      <div className="flex rounded-lg border bg-muted/40 p-0.5" role="tablist" aria-label="Calendar view">
        {VIEWS.map((v) => (
          <button
            key={v.value}
            type="button"
            role="tab"
            aria-selected={view === v.value}
            onClick={() => onView(v.value)}
            className={cn(
              'rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors sm:px-3',
              view === v.value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {v.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  MEETING: 'bg-blue-500',
  CALL: 'bg-green-500',
  DEMO: 'bg-purple-500',
  FOLLOW_UP: 'bg-yellow-500',
  PRESENTATION: 'bg-pink-500',
  NEGOTIATION: 'bg-orange-500',
  CLOSING: 'bg-red-500',
  OTHER: 'bg-gray-500',
};

export default function CalendarPage() {
  return (
    <Suspense fallback={null}>
      <CalendarPageInner />
    </Suspense>
  );
}

function CalendarPageInner() {
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const { path, workspaceFetch } = useWorkspacePaths();
  const searchParams = useSearchParams();
  // Lead/deal pickers only load for the modules on the plan
  const planModules = useFeatureModuleMap();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [view, setView] = useState<View>('month');
  // ?date= deep link (e.g. "Show in calendar" from a meeting)
  const [date, setDate] = useState(() => {
    const raw = searchParams.get('date');
    const d = raw ? new Date(raw) : null;
    return d && !Number.isNaN(d.getTime()) ? d : new Date();
  });
  // Team meetings
  const { data: meetingsNow } = useMeetingsNow();
  const meetingsReady = meetingsNow?.ready !== false;
  const videoConfigured = !!meetingsNow?.video.configured;
  const meetingActions = useMeetingActions();
  const [meetingFields, setMeetingFields] = useState<MeetingFieldsValue>(() => defaultMeetingFields(false));
  const [savingEvent, setSavingEvent] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [editMeeting, setEditMeeting] = useState<MeetingDTO | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    location: '',
    eventType: 'MEETING',
    startTime: '',
    endTime: '',
    allDay: false,
    attendees: '',
    meetingLink: '',
    leadId: '',
    dealId: '',
  });

  useEffect(() => {
    fetchEvents();
  }, [date, view]);

  useEffect(() => {
    if (planModules) fetchLeadsAndDeals();
  }, [planModules]);

  // Invites, replies and room changes from teammates show up without a reload
  useRealtime({
    types: [REALTIME_EVENTS.MEETING_UPDATED],
    onEvent: () => {
      void fetchEvents();
    },
  });

  useEffect(() => {
    if (showCreateDialog) {
      setMeetingFields(defaultMeetingFields(videoConfigured));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when the dialog opens
  }, [showCreateDialog]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const startDate = view === 'month' 
        ? subMonths(date, 1)
        : new Date(date.getFullYear(), date.getMonth(), 1);
      const endDate = view === 'month'
        ? addMonths(date, 2)
        : new Date(date.getFullYear(), date.getMonth() + 1, 0);

      const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });

      const response = await workspaceFetch(`/api/calendar?${params}`);
      if (response.ok) {
        const data: CalendarEvent[] = await response.json();
        setEvents(data);
        // Keep an open event dialog in sync (RSVPs, who's in the room)
        setSelectedEvent((prev) => (prev ? data.find((e) => e.id === prev.id) ?? prev : prev));
      }
    } catch (error) {
      console.error('Failed to fetch events:', error);
      toast({
        title: 'Error',
        description: 'Failed to load calendar events',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchLeadsAndDeals = async () => {
    try {
      const [leadsRes, dealsRes] = await Promise.all([
        planModules?.LEADS ? fetch('/api/leads') : null,
        planModules?.DEALS ? fetch('/api/deals') : null,
      ]);

      if (leadsRes?.ok) {
        const leadsData = await leadsRes.json();
        setLeads(leadsData.leads || []);
      }

      if (dealsRes?.ok) {
        const dealsData = await dealsRes.json();
        setDeals(dealsData || []);
      }
    } catch (error) {
      console.error('Failed to fetch leads/deals:', error);
    }
  };

  const handleSelectSlot = ({ start, end }: { start: Date; end: Date }) => {
    setFormData({
      ...formData,
      startTime: format(start, "yyyy-MM-dd'T'HH:mm"),
      endTime: format(end, "yyyy-MM-dd'T'HH:mm"),
    });
    setShowCreateDialog(true);
  };

  const handleSelectEvent = (event: any) => {
    const calendarEvent = events.find((e) => e.id === event.id);
    if (calendarEvent) {
      setConfirmCancel(false);
      setSelectedEvent(calendarEvent);
      setShowEventDialog(true);
    }
  };

  const isTeamMeetingForm = formData.eventType === 'MEETING' && meetingsReady;

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();

    // Meetings go through the team-meetings API: guests, invites, RSVP, video room
    if (isTeamMeetingForm) {
      setSavingEvent(true);
      meetingActions.create.mutate(
        {
          title: formData.title,
          agenda: formData.description || undefined,
          location: meetingFields.provider === 'NONE' ? formData.location || undefined : undefined,
          startTime: new Date(formData.startTime).toISOString(),
          endTime: new Date(formData.endTime).toISOString(),
          ...meetingFieldsPayload(meetingFields),
        },
        {
          onSuccess: (data) => {
            const guests = meetingFields.attendeeIds.length;
            toast({
              title: data.count > 1 ? `${data.count} meetings scheduled` : 'Meeting scheduled',
              description: guests
                ? `Invitations sent to ${guests} ${guests === 1 ? 'person' : 'people'}.`
                : 'It’s on your calendar.',
            });
            setShowCreateDialog(false);
            resetForm();
            fetchEvents();
          },
          onError: (error) =>
            toast({ title: 'Could not schedule the meeting', description: error.message, variant: 'destructive' }),
          onSettled: () => setSavingEvent(false),
        }
      );
      return;
    }

    try {
      const response = await fetch('/api/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description || undefined,
          location: formData.location || undefined,
          eventType: formData.eventType,
          // datetime-local has no zone — send the user's local time as an absolute instant
          startTime: new Date(formData.startTime).toISOString(),
          endTime: new Date(formData.endTime).toISOString(),
          allDay: formData.allDay,
          attendees: formData.attendees ? formData.attendees.split(',').map(e => e.trim()) : undefined,
          meetingLink: formData.meetingLink || undefined,
          leadId: formData.leadId && formData.leadId !== 'none' ? formData.leadId : undefined,
          dealId: formData.dealId || undefined,
        }),
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Calendar event created successfully',
        });
        setShowCreateDialog(false);
        resetForm();
        fetchEvents();
      } else {
        throw new Error('Failed to create event');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create calendar event',
        variant: 'destructive',
      });
    }
  };

  const handleCancelMeeting = (meeting: MeetingDTO, series: boolean) => {
    meetingActions.cancel.mutate(
      { id: meeting.id, series },
      {
        onSuccess: (data) => {
          toast({
            title: data.cancelled > 1 ? `${data.cancelled} meetings cancelled` : 'Meeting cancelled',
            description: 'Guests were notified.',
          });
          setConfirmCancel(false);
          setShowEventDialog(false);
          setSelectedEvent(null);
          fetchEvents();
        },
        onError: (error) => toast({ title: 'Could not cancel', description: error.message, variant: 'destructive' }),
      }
    );
  };

  const handleDeleteEvent = async (eventId: string) => {
    try {
      const response = await fetch(`/api/calendar/${eventId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Event deleted successfully',
        });
        setShowEventDialog(false);
        setSelectedEvent(null);
        fetchEvents();
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete event',
        variant: 'destructive',
      });
    }
  };

  const handleCompleteEvent = async (eventId: string) => {
    try {
      const response = await fetch(`/api/calendar/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'COMPLETED' }),
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Event marked as completed',
        });
        setShowEventDialog(false);
        fetchEvents();
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update event',
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      location: '',
      eventType: 'MEETING',
      startTime: '',
      endTime: '',
      allDay: false,
      attendees: '',
      meetingLink: '',
      leadId: '',
      dealId: '',
    });
  };

  const calendarEvents = events.map((event) => ({
    id: event.id,
    title: event.title,
    start: new Date(event.startTime),
    end: new Date(event.endTime),
    allDay: event.allDay,
    resource: event,
  }));

  const eventStyleGetter = (event: any) => {
    const color = EVENT_TYPE_HEX[event.resource.eventType] || EVENT_TYPE_HEX.OTHER;
    const done = event.resource.status === 'COMPLETED' || event.resource.status === 'CANCELLED';
    const meeting: MeetingDTO | undefined = event.resource.meeting;
    const rsvp = meeting && !meeting.isOrganizer ? meeting.myRsvp : null;
    const live = meeting ? phaseOf(meeting, new Date()) === 'live' && event.resource.status !== 'CANCELLED' : false;
    const edge = live ? '#ef4444' : color;
    // Google-style reply states: unanswered = outlined, maybe = striped
    const background =
      rsvp === 'PENDING'
        ? 'hsl(var(--background))'
        : rsvp === 'TENTATIVE'
          ? `repeating-linear-gradient(135deg, ${color}1f 0 6px, ${color}0a 6px 12px)`
          : `${color}1f`;
    return {
      style: {
        background,
        border: rsvp === 'PENDING' ? `1px dashed ${color}` : undefined,
        borderLeft: `3px solid ${edge}`,
        color: 'hsl(var(--foreground))',
        opacity: done ? 0.55 : 1,
        textDecoration: event.resource.status === 'CANCELLED' ? 'line-through' : undefined,
      },
    };
  };

  // Static header and the calendar render immediately; only the events load (no page skeleton)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="mb-1 text-2xl font-bold tracking-tight sm:text-3xl">Calendar</h1>
          <p className="text-sm text-muted-foreground">
            Manage your meetings and events.{' '}
            <a
              href={path('/dashboard/customers')}
              className="text-primary underline underline-offset-2"
            >
              Customer visits
            </a>{' '}
            are scheduled on each client&apos;s Visits tab.
          </p>
        </div>
        <div className="flex shrink-0 gap-2 self-start sm:self-auto">
          {meetingsReady ? (
            <Button variant="outline" onClick={() => setScheduleOpen(true)}>
              <Video className="h-4 w-4" />
              Schedule meeting
            </Button>
          ) : null}
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4" />
            New Event
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-3 sm:p-5">
          <div className="opslane-calendar h-[calc(100dvh-15rem)] min-h-[560px] min-w-0">
            <Calendar
              components={{
                toolbar: (props: ToolbarProps) => <CalendarToolbar {...props} loading={loading} />,
                event: CalendarEventChip as never,
              }}
              localizer={localizer}
              events={calendarEvents}
              startAccessor="start"
              endAccessor="end"
              view={view}
              onView={setView}
              date={date}
              onNavigate={setDate}
              onSelectSlot={handleSelectSlot}
              onSelectEvent={handleSelectEvent}
              selectable
              eventPropGetter={eventStyleGetter}
              formats={{ dateFormat: 'd', weekdayFormat: 'EEE', dayFormat: 'EEE d' }}
              popup
            />
          </div>
        </CardContent>
      </Card>

      {/* Create Event Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isTeamMeetingForm ? 'New meeting' : 'Create Calendar Event'}</DialogTitle>
            <DialogDescription>
              {isTeamMeetingForm
                ? 'Invite teammates — they get an invite to accept or decline, a reminder, and a one-click Join.'
                : 'Schedule a new meeting or event'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateEvent} className="space-y-4">
            <div>
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Meeting title"
                required
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="eventType">Type</Label>
                <Select value={formData.eventType} onValueChange={(value) => setFormData({ ...formData, eventType: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className={isTeamMeetingForm ? 'hidden' : undefined}>
                <Label htmlFor="leadId">Link to Lead</Label>
                <Select value={formData.leadId} onValueChange={(value) => setFormData({ ...formData, leadId: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select lead (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {leads.map((lead) => (
                      <SelectItem key={lead.id} value={lead.id}>
                        {lead.companyName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="startTime">Start Time *</Label>
                <Input
                  id="startTime"
                  type="datetime-local"
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="endTime">End Time *</Label>
                <Input
                  id="endTime"
                  type="datetime-local"
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="description">{isTeamMeetingForm ? 'Agenda' : 'Description'}</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={isTeamMeetingForm ? 'What do you want to cover?' : 'Event details...'}
                rows={3}
              />
            </div>

            {isTeamMeetingForm ? (
              <>
                <MeetingFields value={meetingFields} onChange={setMeetingFields} videoConfigured={videoConfigured} />
                {meetingFields.provider === 'NONE' ? (
                  <div>
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      placeholder="Conference room, office…"
                    />
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <div>
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="Office, Zoom, etc."
                  />
                </div>

                <div>
                  <Label htmlFor="meetingLink">Meeting Link</Label>
                  <Input
                    id="meetingLink"
                    value={formData.meetingLink}
                    onChange={(e) => setFormData({ ...formData, meetingLink: e.target.value })}
                    placeholder="https://zoom.us/j/..."
                  />
                </div>

                <div>
                  <Label htmlFor="attendees">Attendees</Label>
                  <Input
                    id="attendees"
                    value={formData.attendees}
                    onChange={(e) => setFormData({ ...formData, attendees: e.target.value })}
                    placeholder="email1@example.com, email2@example.com"
                  />
                  <p className="text-xs text-gray-500 mt-1">Comma-separated email addresses</p>
                </div>
              </>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={savingEvent}>
                {savingEvent ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isTeamMeetingForm
                  ? meetingFields.attendeeIds.length
                    ? 'Send invites'
                    : 'Create meeting'
                  : 'Create Event'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Event Dialog */}
      <Dialog open={showEventDialog} onOpenChange={setShowEventDialog}>
        <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2 pr-6">
              <span className="min-w-0 break-words">{selectedEvent?.title}</span>
              {selectedEvent?.meeting ? (
                <Badge variant="secondary" className="gap-1">
                  <Video className="h-3 w-3" /> Team meeting
                </Badge>
              ) : (
                <Badge className={EVENT_TYPE_COLORS[selectedEvent?.eventType || 'OTHER']}>
                  {selectedEvent?.eventType}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription asChild>
              <div>
                {selectedEvent?.meeting ? (
                  <MeetingPhaseBadge meeting={selectedEvent.meeting} />
                ) : (
                  <Badge variant={selectedEvent?.status === 'COMPLETED' ? 'default' : 'outline'}>
                    {selectedEvent?.status}
                  </Badge>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>

          {selectedEvent && (
            <div className="space-y-4">
              <div className="flex items-start gap-2">
                <Clock className="h-4 w-4 mt-1 text-gray-500" />
                <div>
                  <p className="font-medium">
                    {format(new Date(selectedEvent.startTime), 'PPP p')}
                  </p>
                  <p className="text-sm text-gray-500">
                    to {format(new Date(selectedEvent.endTime), 'PPP p')}
                  </p>
                </div>
              </div>

              {selectedEvent.meeting ? (
                <div className="space-y-3">
                  {selectedEvent.meeting.status !== 'CANCELLED' ? (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                      <span className="text-sm text-muted-foreground">
                        {selectedEvent.meeting.provider === 'OPSLANE'
                          ? 'Opslane video room'
                          : selectedEvent.meeting.provider === 'EXTERNAL'
                            ? 'External meeting link'
                            : 'In person'}
                        {selectedEvent.meeting.liveCount > 0
                          ? ` · ${selectedEvent.meeting.liveCount} in the room now`
                          : ''}
                      </span>
                      <JoinButton meeting={selectedEvent.meeting} />
                    </div>
                  ) : null}
                  {selectedEvent.meeting.myRsvp && !selectedEvent.meeting.isOrganizer && selectedEvent.meeting.status !== 'CANCELLED' ? (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium">Going?</span>
                      <RsvpControl meeting={selectedEvent.meeting} />
                    </div>
                  ) : null}
                  <div className="space-y-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-sm font-medium">Guests ({selectedEvent.meeting.attendees.length})</p>
                      <RsvpSummaryText meeting={selectedEvent.meeting} />
                    </div>
                    <div className="max-h-56 overflow-y-auto">
                      <AttendeeList meeting={selectedEvent.meeting} />
                    </div>
                  </div>
                  <MeetingNotesPreview meeting={selectedEvent.meeting} />
                </div>
              ) : null}

              {selectedEvent.description && (
                <div>
                  <p className="font-medium mb-1">{selectedEvent.meeting ? 'Agenda' : 'Description'}</p>
                  <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{selectedEvent.description}</p>
                </div>
              )}

              {selectedEvent.location && (
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 mt-1 text-gray-500" />
                  <p className="text-sm">{selectedEvent.location}</p>
                </div>
              )}

              {selectedEvent.meetingLink && !selectedEvent.meeting && (
                <div className="flex items-start gap-2">
                  <LinkIcon className="h-4 w-4 mt-1 text-gray-500" />
                  <a
                    href={selectedEvent.meetingLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-w-0 break-all text-sm text-blue-600 hover:underline"
                  >
                    {selectedEvent.meetingLink}
                  </a>
                </div>
              )}

              {selectedEvent.attendees && selectedEvent.attendees.length > 0 && (
                <div className="flex items-start gap-2">
                  <Users className="h-4 w-4 mt-1 text-gray-500" />
                  <div className="text-sm">
                    {(selectedEvent.attendees as string[]).join(', ')}
                  </div>
                </div>
              )}

              {selectedEvent.lead && (
                <div>
                  <p className="font-medium mb-1">Linked Lead</p>
                  <a
                    href={path(`/dashboard/leads/${selectedEvent.lead.id}`)}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    {selectedEvent.lead.companyName} ({selectedEvent.lead.contactName})
                  </a>
                </div>
              )}

              {selectedEvent.deal && (
                <div>
                  <p className="font-medium mb-1">Linked Deal</p>
                  <a
                    href={path('/dashboard/deals')}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    {selectedEvent.deal.title} - {formatCurrency(selectedEvent.deal.value)}
                  </a>
                </div>
              )}
            </div>
          )}

          {selectedEvent?.meeting ? (
            <DialogFooter className="flex-col gap-2 sm:flex-row sm:gap-2">
              {selectedEvent.meeting.canManage && selectedEvent.meeting.status !== 'CANCELLED' ? (
                confirmCancel ? (
                  <div className="flex flex-1 flex-wrap items-center gap-2">
                    <span className="text-sm">Cancel and notify guests?</span>
                    {selectedEvent.meeting.seriesId ? (
                      <Button size="sm" variant="outline" onClick={() => handleCancelMeeting(selectedEvent.meeting!, true)} disabled={meetingActions.cancel.isPending}>
                        This and following
                      </Button>
                    ) : null}
                    <Button size="sm" variant="destructive" onClick={() => handleCancelMeeting(selectedEvent.meeting!, false)} disabled={meetingActions.cancel.isPending}>
                      {selectedEvent.meeting.seriesId ? 'Only this one' : 'Yes, cancel'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmCancel(false)}>
                      Keep
                    </Button>
                  </div>
                ) : (
                  <>
                    <Button variant="outline" onClick={() => setConfirmCancel(true)} className="text-destructive hover:text-destructive">
                      <CalendarX className="h-4 w-4" />
                      Cancel meeting
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditMeeting(selectedEvent.meeting!);
                        setShowEventDialog(false);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                      Edit
                    </Button>
                  </>
                )
              ) : null}
              {!confirmCancel ? (
                <Button asChild>
                  <Link href={path(`/dashboard/meetings/${selectedEvent.meeting.id}`)}>Open meeting</Link>
                </Button>
              ) : null}
            </DialogFooter>
          ) : (
            <DialogFooter className="flex gap-2">
              {selectedEvent?.status === 'SCHEDULED' && (
                <Button
                  variant="outline"
                  onClick={() => handleCompleteEvent(selectedEvent.id)}
                >
                  <Check className="h-4 w-4 mr-2" />
                  Mark Complete
                </Button>
              )}
              <Button
                variant="destructive"
                onClick={() => handleDeleteEvent(selectedEvent?.id || '')}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <ScheduleMeetingDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        onSaved={() => fetchEvents()}
      />
      <ScheduleMeetingDialog
        open={!!editMeeting}
        onOpenChange={(open) => {
          if (!open) setEditMeeting(null);
        }}
        meeting={editMeeting}
        onSaved={() => fetchEvents()}
      />

      {/* Event type key */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1 text-xs text-muted-foreground">
        {EVENT_TYPES.map((type) => (
          <span key={type.value} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: EVENT_TYPE_HEX[type.value] }} />
            {type.label}
          </span>
        ))}
        {meetingsReady ? (
          <>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-4 rounded-sm border border-dashed" style={{ borderColor: EVENT_TYPE_HEX.MEETING }} />
              Awaiting your reply
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="h-2.5 w-4 rounded-sm"
                style={{ background: `repeating-linear-gradient(135deg, ${EVENT_TYPE_HEX.MEETING}55 0 3px, transparent 3px 6px)` }}
              />
              Maybe
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              Live now
            </span>
          </>
        ) : null}
      </div>
    </div>
  );
}

