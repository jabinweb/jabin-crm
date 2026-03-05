import { google } from 'googleapis';
import { prisma } from '@/lib/prisma';
import { logError } from '@/lib/logger';

interface GoogleCalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
  attendees?: Array<{ email: string }>;
  conferenceData?: any;
}

export class GoogleCalendarSync {
  private calendar;

  constructor(accessToken: string, refreshToken?: string) {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.AUTH_URL + '/api/auth/callback/google'
    );

    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    this.calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  }

  // Sync a local event to Google Calendar
  async syncEventToGoogle(eventId: string, userId: string) {
    try {
      const event = await prisma.calendarEvent.findFirst({
        where: { id: eventId, userId },
      });

      if (!event) {
        throw new Error('Event not found');
      }

      const googleEvent: GoogleCalendarEvent = {
        summary: event.title,
        description: event.description || undefined,
        location: event.location || undefined,
        start: event.allDay
          ? { date: event.startTime.toISOString().split('T')[0] }
          : { dateTime: event.startTime.toISOString() },
        end: event.allDay
          ? { date: event.endTime.toISOString().split('T')[0] }
          : { dateTime: event.endTime.toISOString() },
        attendees: (event.attendees as string[] || []).map((email) => ({ email })),
      };

      if (event.googleCalendarId) {
        // Update existing Google Calendar event
        const response = await this.calendar.events.update({
          calendarId: 'primary',
          eventId: event.googleCalendarId,
          requestBody: googleEvent,
        });

        return response.data;
      } else {
        // Create new Google Calendar event
        const response = await this.calendar.events.insert({
          calendarId: 'primary',
          requestBody: googleEvent,
        });

        // Update local event with Google Calendar ID
        await prisma.calendarEvent.update({
          where: { id: eventId },
          data: {
            googleCalendarId: response.data.id!,
            googleCalendarSync: true,
          },
        });

        return response.data;
      }
    } catch (error) {
      logError(error, { context: 'Error syncing to Google Calendar' });
      throw error;
    }
  }

  // Import events from Google Calendar
  async importFromGoogle(userId: string, startDate: Date, endDate: Date) {
    try {
      const response = await this.calendar.events.list({
        calendarId: 'primary',
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      });

      const events = response.data.items || [];
      const imported = [];

      for (const googleEvent of events) {
        if (!googleEvent.id || !googleEvent.summary) continue;

        // Check if event already exists
        const existing = await prisma.calendarEvent.findFirst({
          where: {
            userId,
            googleCalendarId: googleEvent.id,
          },
        });

        const startTime = googleEvent.start?.dateTime
          ? new Date(googleEvent.start.dateTime)
          : new Date(googleEvent.start?.date || '');
        const endTime = googleEvent.end?.dateTime
          ? new Date(googleEvent.end.dateTime)
          : new Date(googleEvent.end?.date || '');

        const eventData = {
          title: googleEvent.summary,
          description: googleEvent.description || null,
          location: googleEvent.location || null,
          startTime,
          endTime,
          allDay: !!googleEvent.start?.date,
          attendees: (googleEvent.attendees?.map((a) => a.email).filter(Boolean) || []) as string[],
          googleCalendarId: googleEvent.id,
          googleCalendarSync: true,
        };

        if (existing) {
          // Update existing event
          const updated = await prisma.calendarEvent.update({
            where: { id: existing.id },
            data: eventData,
          });
          imported.push(updated);
        } else {
          // Create new event
          const created = await prisma.calendarEvent.create({
            data: {
              ...eventData,
              userId,
            },
          });
          imported.push(created);
        }
      }

      return imported;
    } catch (error) {
      logError(error, { context: 'Error importing from Google Calendar' });
      throw error;
    }
  }

  // Delete event from Google Calendar
  async deleteFromGoogle(googleCalendarId: string) {
    try {
      await this.calendar.events.delete({
        calendarId: 'primary',
        eventId: googleCalendarId,
      });
    } catch (error) {
      logError(error, { context: 'Error deleting from Google Calendar' });
      throw error;
    }
  }

  // Get user's calendars
  async getCalendars() {
    try {
      const response = await this.calendar.calendarList.list();
      return response.data.items || [];
    } catch (error) {
      logError(error, { context: 'Error fetching calendars' });
      throw error;
    }
  }

  // Check if user has calendar access
  static async hasCalendarAccess(userId: string): Promise<boolean> {
    const account = await prisma.account.findFirst({
      where: {
        userId,
        provider: 'google',
      },
    });

    return !!(account?.access_token && account?.scope?.includes('calendar'));
  }

  // Get access token for user
  static async getAccessToken(userId: string): Promise<{
    accessToken: string;
    refreshToken?: string;
  } | null> {
    const account = await prisma.account.findFirst({
      where: {
        userId,
        provider: 'google',
      },
    });

    if (!account?.access_token) {
      return null;
    }

    return {
      accessToken: account.access_token,
      refreshToken: account.refresh_token || undefined,
    };
  }
}

// Helper function to get sync client for user
export async function getGoogleCalendarSync(userId: string) {
  const tokens = await GoogleCalendarSync.getAccessToken(userId);

  if (!tokens) {
    throw new Error('No Google Calendar access. Please connect your Google account.');
  }

  return new GoogleCalendarSync(tokens.accessToken, tokens.refreshToken);
}
