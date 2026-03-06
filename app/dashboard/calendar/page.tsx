'use client';

import { useEffect, useState } from 'react';
import { Calendar, dateFnsLocalizer, View } from 'react-big-calendar';
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
import { CalendarIcon, Clock, MapPin, Users, Link as LinkIcon, Plus, Trash2, Check, X } from 'lucide-react';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { useCurrency } from '@/hooks/use-currency';

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
    fetchLeadsAndDeals();
  }, [date, view]);

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
        fetch('/api/leads'),
        fetch('/api/deals'),
      ]);

      if (leadsRes.ok) {
        const leadsData = await leadsRes.json();
        setLeads(leadsData.leads || []);
      }

      if (dealsRes.ok) {
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
          startTime: formData.startTime,
          endTime: formData.endTime,
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
    const bgColor = EVENT_TYPE_COLORS[event.resource.eventType] || 'bg-gray-500';
    return {
      className: bgColor.replace('bg-', 'rbc-event-'),
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading calendar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Calendar</h1>
          <p className="text-gray-500">Manage your meetings and events</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Event
        </Button>
      </div>

      <Card>
        <CardContent className="p-6">
          <div style={{ height: '700px' }}>
            <Calendar
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

            <div className="grid grid-cols-2 gap-4">
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

            <div className="grid grid-cols-2 gap-4">
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
                    className="text-sm text-blue-600 hover:underline"
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
                    href={`/dashboard/leads/${selectedEvent.lead.id}`}
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
                    href={`/dashboard/deals`}
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

      {/* Event Type Legend */}
      <Card>
        <CardHeader>
          <CardTitle>Event Types</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {EVENT_TYPES.map((type) => (
              <Badge key={type.value} className={EVENT_TYPE_COLORS[type.value]}>
                {type.label}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
