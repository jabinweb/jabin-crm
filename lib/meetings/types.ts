/** Team meeting shapes shared by API responses and the client (no server imports). */
import type { MeetingProvider, Recurrence, Rsvp } from './rules';

export type MeetingPerson = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
};

export type MeetingAttendeeDTO = {
  user: MeetingPerson;
  role: 'ORGANIZER' | 'ATTENDEE';
  rsvp: Rsvp;
  respondedAt: string | null;
  inRoom: boolean;
  joinedAt: string | null;
};

export type MeetingDTO = {
  id: string;
  eventId: string;
  title: string;
  agenda: string | null;
  location: string | null;
  startTime: string;
  endTime: string;
  /** CalendarEvent status: SCHEDULED | COMPLETED | CANCELLED | … */
  status: string;
  provider: MeetingProvider;
  /** External link (Google Meet / Zoom / …) when provider is EXTERNAL */
  meetingLink: string | null;
  reminderMinutes: number | null;
  recurrence: Recurrence;
  seriesId: string | null;
  startedAt: string | null;
  endedAt: string | null;
  organizer: MeetingPerson;
  attendees: MeetingAttendeeDTO[];
  /** People in the video room right now */
  liveCount: number;
  /** The viewer's own answer (null if they are not invited — e.g. an admin looking in) */
  myRsvp: Rsvp | null;
  isOrganizer: boolean;
  canManage: boolean;
};

export type MeetingsVideoConfig = {
  /** Built-in (LiveKit) video rooms are available */
  configured: boolean;
};

export type MeetingListResponse = {
  meetings: MeetingDTO[];
  video: MeetingsVideoConfig;
};

export type MeetingsNowResponse = {
  /** Live or starting within 15 minutes, for the header indicator */
  meetings: MeetingDTO[];
  /** Invitations still awaiting the viewer's answer (upcoming only) */
  pendingInvites: number;
  video: MeetingsVideoConfig;
  /** false until the team-meetings migration is applied */
  ready: boolean;
};
