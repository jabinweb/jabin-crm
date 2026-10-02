'use client';

import { useEffect, useState } from 'react';
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
import { CalendarIcon, Clock, MapPin, Users, Link as LinkIcon, Plus, Trash2, Check, X, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { useCurrency } from '@/hooks/use-currency';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { useFeatureModuleMap } from '@/components/feature-module-guard';

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
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const { path } = useWorkspacePaths();
  // Lead/deal pickers only load for the modules on the plan
  const planModules = useFeatureModuleMap();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [view, setView] = useState<View>('month');
  const [date, setDate] = useState(new Date());
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

      const response = await fetch(`/api/calendar?${params}`);
      if (response.ok) {
        const data = await response.json();
        setEvents(data);
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
      setSelectedEvent(calendarEvent);
      setShowEventDialog(true);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();

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
    return {
      style: {
        backgroundColor: `${color}1f`,
        borderLeft: `3px solid ${color}`,
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
        <Button onClick={() => setShowCreateDialog(true)} className="self-start sm:self-auto">
          <Plus className="h-4 w-4 mr-2" />
          New Event
        </Button>
      </div>

      <Card>
        <CardContent className="p-3 sm:p-5">
          <div className="opslane-calendar h-[calc(100dvh-15rem)] min-h-[560px] min-w-0">
            <Calendar
              components={{
                toolbar: (props: ToolbarProps) => <CalendarToolbar {...props} loading={loading} />,
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
            <DialogTitle>Create Calendar Event</DialogTitle>
            <DialogDescription>Schedule a new meeting or event</DialogDescription>
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

              <div>
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
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Event details..."
                rows={3}
              />
            </div>

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

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button type="submit">Create Event</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Event Dialog */}
      <Dialog open={showEventDialog} onOpenChange={setShowEventDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedEvent?.title}
              <Badge className={EVENT_TYPE_COLORS[selectedEvent?.eventType || 'OTHER']}>
                {selectedEvent?.eventType}
              </Badge>
            </DialogTitle>
            <DialogDescription>
              <Badge variant={selectedEvent?.status === 'COMPLETED' ? 'default' : 'outline'}>
                {selectedEvent?.status}
              </Badge>
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

              {selectedEvent.description && (
                <div>
                  <p className="font-medium mb-1">Description</p>
                  <p className="text-sm text-gray-600">{selectedEvent.description}</p>
                </div>
              )}

              {selectedEvent.location && (
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 mt-1 text-gray-500" />
                  <p className="text-sm">{selectedEvent.location}</p>
                </div>
              )}

              {selectedEvent.meetingLink && (
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
        </DialogContent>
      </Dialog>

      {/* Event type key */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1 text-xs text-muted-foreground">
        {EVENT_TYPES.map((type) => (
          <span key={type.value} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: EVENT_TYPE_HEX[type.value] }} />
            {type.label}
          </span>
        ))}
      </div>
    </div>
  );
}

