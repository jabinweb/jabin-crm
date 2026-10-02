/**
 * Calendar integration: the calendar API lists the caller's own CalendarEvents; this adds
 * team-meeting details (guests, RSVPs, room state) to the ones that are meetings and merges
 * in meetings the caller is invited to (those events belong to the organizer).
 */
import { logError } from '@/lib/logger';
import {
  invitedMeetingsInRange,
  isMeetingsSchemaMissing,
  meetingsForEvents,
  toMeetingDTO,
} from './service';
import type { MeetingViewer } from './rules';
import type { MeetingDTO } from './types';

type CalendarRow = { id: string; [key: string]: unknown };

export type CalendarEventWithMeeting = CalendarRow & { meeting?: MeetingDTO; invited?: boolean };

export async function withTeamMeetings(
  events: CalendarRow[],
  opts: {
    viewer: MeetingViewer;
    companyId?: string;
    range: { startDate?: Date; endDate?: Date };
    eventType?: string | null;
  }
): Promise<CalendarEventWithMeeting[]> {
  try {
    const own = await meetingsForEvents(events.map((e) => e.id));
    const byEvent = new Map<string, MeetingDTO>(
      own.map((row: { eventId: string }) => [row.eventId, toMeetingDTO(row, opts.viewer)])
    );
    const result: CalendarEventWithMeeting[] = events.map((e) =>
      byEvent.has(e.id) ? { ...e, meeting: byEvent.get(e.id) } : e
    );

    if (opts.companyId && (!opts.eventType || opts.eventType === 'MEETING')) {
      const invited = await invitedMeetingsInRange(opts.viewer.userId, opts.range, opts.companyId);
      for (const row of invited) {
        const dto = toMeetingDTO(row, opts.viewer);
        result.push({
          id: row.event.id,
          title: dto.title,
          description: dto.agenda,
          location: dto.location,
          eventType: 'MEETING',
          startTime: dto.startTime,
          endTime: dto.endTime,
          allDay: false,
          attendees: [],
          meetingLink: dto.meetingLink,
          status: dto.status,
          meeting: dto,
          invited: true,
        });
      }
      result.sort(
        (a, b) => new Date(String(a.startTime)).getTime() - new Date(String(b.startTime)).getTime()
      );
    }
    return result;
  } catch (error) {
    if (!isMeetingsSchemaMissing(error)) {
      logError(error, { context: 'calendar: team meetings merge failed' });
    }
    return events;
  }
}
