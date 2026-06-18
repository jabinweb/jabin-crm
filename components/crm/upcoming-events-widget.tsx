'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, MapPin, ExternalLink } from 'lucide-react';
import { format, isToday, isTomorrow, isPast } from 'date-fns';
import Link from 'next/link';
import { DashboardLink } from '@/components/navigation/dashboard-link';

interface UpcomingEvent {
  id: string;
  title: string;
  eventType: string;
  startTime: string;
  endTime: string;
  location?: string;
  status: string;
  lead?: {
    companyName: string;
  };
  deal?: {
    title: string;
  };
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

export function UpcomingEventsWidget() {
  const [events, setEvents] = useState<UpcomingEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUpcomingEvents();
  }, []);

  const fetchUpcomingEvents = async () => {
    try {
      const response = await fetch('/api/calendar/upcoming?days=7');
      if (response.ok) {
        const data = await response.json();
        setEvents(data.slice(0, 5)); // Show only 5 upcoming events
      }
    } catch (error) {
      console.error('Failed to fetch upcoming events:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTimeLabel = (dateString: string) => {
    const date = new Date(dateString);
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'EEE, MMM d');
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Upcoming Events
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-none h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Upcoming Events
          </CardTitle>
          <DashboardLink href="/dashboard/calendar">
            <Button variant="ghost" size="sm">
              View All
              <ExternalLink className="h-4 w-4 ml-2" />
            </Button>
          </DashboardLink>
        </div>
        <CardDescription>Your next meetings and events</CardDescription>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Calendar className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>No upcoming events</p>
            <DashboardLink href="/dashboard/calendar">
              <Button variant="link" size="sm" className="mt-2">
                Schedule a meeting
              </Button>
            </DashboardLink>
          </div>
        ) : (
          <div className="space-y-4">
            {events.map((event) => {
              const startTime = new Date(event.startTime);
              const endTime = new Date(event.endTime);
              const isPastEvent = isPast(endTime);

              return (
                <div
                  key={event.id}
                  className={`p-4 border rounded-none ${isPastEvent ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="font-medium">{event.title}</h3>
                      {(event.lead || event.deal) && (
                        <p className="text-sm text-gray-500">
                          {event.lead?.companyName || event.deal?.title}
                        </p>
                      )}
                    </div>
                    <Badge className={EVENT_TYPE_COLORS[event.eventType]}>
                      {event.eventType}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      <span>{getTimeLabel(event.startTime)}</span>
                    </div>
                    <span>
                      {format(startTime, 'h:mm a')} - {format(endTime, 'h:mm a')}
                    </span>
                  </div>

                  {event.location && (
                    <div className="flex items-center gap-1 text-sm text-gray-600 mt-1">
                      <MapPin className="h-4 w-4" />
                      <span>{event.location}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

