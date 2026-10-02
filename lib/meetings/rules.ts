/**
 * Team meetings — pure rules shared by the API, cron and UI (no Prisma, no React).
 */

export const RSVP_VALUES = ['PENDING', 'ACCEPTED', 'DECLINED', 'TENTATIVE'] as const;
export type Rsvp = (typeof RSVP_VALUES)[number];

export const MEETING_PROVIDERS = ['OPSLANE', 'EXTERNAL', 'NONE'] as const;
export type MeetingProvider = (typeof MEETING_PROVIDERS)[number];

export const RECURRENCES = ['NONE', 'DAILY', 'WEEKDAYS', 'WEEKLY'] as const;
export type Recurrence = (typeof RECURRENCES)[number];

/** Upper bound on occurrences created by one "Repeat" (keeps a typo from filling the calendar). */
export const MAX_OCCURRENCES = 26;
export const MAX_ATTENDEES = 100;
/** "Starting soon" window shown in the header and on events. */
export const SOON_WINDOW_MS = 15 * 60_000;
/** The room opens this early so people can check camera and mic. */
export const JOIN_EARLY_MS = 15 * 60_000;
/** ...and stays joinable this long after the scheduled end (meetings overrun). */
export const JOIN_GRACE_MS = 60 * 60_000;
export const DEFAULT_REMINDER_MINUTES = 10;

export function isRsvp(value: unknown): value is Rsvp {
  return typeof value === 'string' && (RSVP_VALUES as readonly string[]).includes(value);
}

export function isProvider(value: unknown): value is MeetingProvider {
  return typeof value === 'string' && (MEETING_PROVIDERS as readonly string[]).includes(value);
}

export function isRecurrence(value: unknown): value is Recurrence {
  return typeof value === 'string' && (RECURRENCES as readonly string[]).includes(value);
}

export const RSVP_LABEL: Record<Rsvp, string> = {
  PENDING: 'Awaiting reply',
  ACCEPTED: 'Going',
  DECLINED: 'Not going',
  TENTATIVE: 'Maybe',
};

export type RsvpSummary = Record<Rsvp, number> & { total: number };

export function summarizeRsvps(rows: Array<{ rsvp: string }>): RsvpSummary {
  const summary: RsvpSummary = { PENDING: 0, ACCEPTED: 0, DECLINED: 0, TENTATIVE: 0, total: 0 };
  for (const row of rows) {
    const key = isRsvp(row.rsvp) ? row.rsvp : 'PENDING';
    summary[key] += 1;
    summary.total += 1;
  }
  return summary;
}

// ── Who may do what ──────────────────────────────────────────────────────────

export type MeetingViewer = {
  userId: string;
  role?: string | null;
  /** Is the viewer staff of the meeting's workspace (never true for portal customers)? */
  isWorkspaceStaff: boolean;
};

export type MeetingAccessShape = {
  organizerId: string;
  attendeeIds: string[];
};

const ADMIN_ROLES = new Set(['ADMIN', 'SUPER_ADMIN']);

export function isWorkspaceAdmin(viewer: Pick<MeetingViewer, 'role'>) {
  return !!viewer.role && ADMIN_ROLES.has(viewer.role);
}

/** Organizer, invited attendees, and workspace admins. Customers never. */
export function canViewMeeting(viewer: MeetingViewer, meeting: MeetingAccessShape) {
  if (viewer.role === 'CUSTOMER' || !viewer.isWorkspaceStaff) return false;
  if (meeting.organizerId === viewer.userId) return true;
  if (meeting.attendeeIds.includes(viewer.userId)) return true;
  return isWorkspaceAdmin(viewer);
}

/** Edit, cancel, end the room for everyone: organizer or workspace admin. */
export function canManageMeeting(viewer: MeetingViewer, meeting: MeetingAccessShape) {
  if (!canViewMeeting(viewer, meeting)) return false;
  return meeting.organizerId === viewer.userId || isWorkspaceAdmin(viewer);
}

/** Only invited people answer an invitation (the organizer is always "going"). */
export function canRespond(viewer: MeetingViewer, meeting: MeetingAccessShape) {
  return (
    canViewMeeting(viewer, meeting) &&
    meeting.organizerId !== viewer.userId &&
    meeting.attendeeIds.includes(viewer.userId)
  );
}

export type JoinWindowShape = {
  status: string;
  startTime: Date | string;
  endTime: Date | string;
  endedAt?: Date | string | null;
};

export type JoinCheck = { ok: true } | { ok: false; reason: string; status: number };

/**
 * Gate for minting a room token. Access first (403), then the meeting's state:
 * cancelled, ended, not open yet, or long over.
 */
export function checkCanJoin(
  viewer: MeetingViewer,
  meeting: MeetingAccessShape & JoinWindowShape,
  now: Date = new Date()
): JoinCheck {
  if (!canViewMeeting(viewer, meeting)) {
    return { ok: false, status: 403, reason: 'Only people invited to this meeting can join it.' };
  }
  if (meeting.status === 'CANCELLED') {
    return { ok: false, status: 409, reason: 'This meeting was cancelled.' };
  }
  const start = new Date(meeting.startTime).getTime();
  const end = new Date(meeting.endTime).getTime();
  const t = now.getTime();
  if (t < start - JOIN_EARLY_MS) {
    return {
      ok: false,
      status: 409,
      reason: 'The room opens 15 minutes before the meeting starts.',
    };
  }
  // An explicit "End for everyone" closes the room; organizers/admins may reopen by joining again
  const ended = meeting.endedAt ? new Date(meeting.endedAt).getTime() : null;
  if (ended && ended > start && !canManageMeeting(viewer, meeting)) {
    return { ok: false, status: 409, reason: 'The organizer ended this meeting.' };
  }
  if (t > end + JOIN_GRACE_MS && !canManageMeeting(viewer, meeting)) {
    return { ok: false, status: 409, reason: 'This meeting is over.' };
  }
  return { ok: true };
}

export type TokenDecision =
  | { ok: true; roomAdmin: boolean }
  | { ok: false; status: number; error: string; code?: string };

/**
 * Server-side guard in front of LiveKit token minting. Never trusts the client:
 * identity comes from the session, access from the attendee list.
 */
export function decideRoomToken(args: {
  viewer: MeetingViewer;
  meeting: MeetingAccessShape & JoinWindowShape & { provider: string };
  liveKitConfigured: boolean;
  now?: Date;
}): TokenDecision {
  const { viewer, meeting } = args;
  if (!canViewMeeting(viewer, meeting)) {
    // Same answer as a missing meeting: don't confirm it exists
    return { ok: false, status: 404, error: 'Meeting not found' };
  }
  if (meeting.provider !== 'OPSLANE') {
    return {
      ok: false,
      status: 409,
      error: 'This meeting uses an external link, not an Opslane room.',
      code: 'EXTERNAL_MEETING',
    };
  }
  if (!args.liveKitConfigured) {
    return {
      ok: false,
      status: 503,
      error: 'Video rooms are not set up for this workspace yet.',
      code: 'VIDEO_NOT_CONFIGURED',
    };
  }
  const join = checkCanJoin(viewer, meeting, args.now);
  if (!join.ok) return { ok: false, status: join.status, error: join.reason };
  return { ok: true, roomAdmin: canManageMeeting(viewer, meeting) };
}

// ── Lifecycle / indicators ───────────────────────────────────────────────────

export type MeetingPhase = 'cancelled' | 'ended' | 'live' | 'soon' | 'upcoming';

export function meetingPhase(
  meeting: JoinWindowShape & { liveCount?: number },
  now: Date = new Date()
): MeetingPhase {
  if (meeting.status === 'CANCELLED') return 'cancelled';
  const start = new Date(meeting.startTime).getTime();
  const end = new Date(meeting.endTime).getTime();
  const t = now.getTime();
  const ended = meeting.endedAt ? new Date(meeting.endedAt).getTime() : null;
  if ((meeting.liveCount ?? 0) > 0 && !(ended && ended >= start && ended <= t)) return 'live';
  if (meeting.status === 'COMPLETED') return 'ended';
  if (ended && ended >= start && ended <= t) return 'ended';
  if (t >= start && t <= end) return 'live';
  if (t > end) return 'ended';
  if (start - t <= SOON_WINDOW_MS) return 'soon';
  return 'upcoming';
}

/** "in 5 min", "in 2 h", "now" — short countdown for badges. */
export function startsInLabel(startTime: Date | string, now: Date = new Date()) {
  const diff = new Date(startTime).getTime() - now.getTime();
  if (diff <= 30_000) return 'now';
  const minutes = Math.round(diff / 60_000);
  if (minutes < 60) return `in ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `in ${hours} h`;
  const days = Math.round(hours / 24);
  return `in ${days} d`;
}

// ── Reminders ────────────────────────────────────────────────────────────────

/** Minutes before start a reminder goes out (event setting, else the default; 0 disables). */
export function reminderLeadMinutes(reminderMinutes: number | null | undefined) {
  if (reminderMinutes === null || reminderMinutes === undefined) return DEFAULT_REMINDER_MINUTES;
  if (!Number.isFinite(reminderMinutes) || reminderMinutes < 0) return DEFAULT_REMINDER_MINUTES;
  return Math.min(reminderMinutes, 7 * 24 * 60);
}

/**
 * Is a reminder due now? Inside [start - lead, start + 5 min) and not sent yet.
 * Late sweeps still remind people shortly after the start, never long after.
 */
export function isReminderDue(
  args: {
    startTime: Date | string;
    reminderMinutes: number | null | undefined;
    reminderSentAt: Date | string | null | undefined;
    rsvp: string;
    status: string;
  },
  now: Date = new Date()
) {
  if (args.reminderSentAt) return false;
  if (args.status === 'CANCELLED' || args.status === 'COMPLETED') return false;
  if (args.rsvp === 'DECLINED') return false;
  const lead = reminderLeadMinutes(args.reminderMinutes);
  if (lead === 0) return false;
  const start = new Date(args.startTime).getTime();
  const t = now.getTime();
  return t >= start - lead * 60_000 && t < start + 5 * 60_000;
}

// ── Recurrence ───────────────────────────────────────────────────────────────

/**
 * Start times for a repeating meeting: `count` occurrences (incl. the first),
 * daily, on weekdays (Mon–Fri), or weekly. Local wall-clock time is kept.
 */
export function occurrenceStarts(first: Date, recurrence: Recurrence, count: number): Date[] {
  const n = recurrence === 'NONE' ? 1 : Math.max(1, Math.min(MAX_OCCURRENCES, Math.floor(count)));
  const out: Date[] = [new Date(first)];
  const cursor = new Date(first);
  while (out.length < n) {
    if (recurrence === 'WEEKLY') {
      cursor.setDate(cursor.getDate() + 7);
    } else {
      cursor.setDate(cursor.getDate() + 1);
      if (recurrence === 'WEEKDAYS') {
        while (cursor.getDay() === 0 || cursor.getDay() === 6) cursor.setDate(cursor.getDate() + 1);
      }
    }
    out.push(new Date(cursor));
  }
  return out;
}

/** External meeting links must be http(s) — never javascript: or data: URLs. */
export function normalizeMeetingLink(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** Unique, unguessable LiveKit room name scoped to the workspace. */
export function buildRoomName(companyId: string, random: string) {
  return `opslane-${companyId.slice(-8)}-${random}`.replace(/[^a-zA-Z0-9_-]/g, '');
}
