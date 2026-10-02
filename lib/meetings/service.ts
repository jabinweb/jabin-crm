/**
 * Team meetings — data access and workflows (create, edit, cancel, RSVP, join/leave, reminders).
 * A meeting is the organizer's CalendarEvent + a TeamMeeting row + one MeetingAttendee per
 * person (the organizer included, as ORGANIZER / ACCEPTED). Everything is scoped by companyId.
 */
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import { ApiException } from '@/lib/api-error-handler';
import { workspaceStaffWhere } from '@/lib/auth/workspace-staff';
import { logError } from '@/lib/logger';
import {
  buildRoomName,
  canManageMeeting,
  canRespond,
  canViewMeeting,
  isProvider,
  isRecurrence,
  isRsvp,
  JOIN_GRACE_MS,
  MAX_ATTENDEES,
  normalizeMeetingLink,
  occurrenceStarts,
  isReminderDue,
  reminderLeadMinutes,
  RSVP_LABEL,
  SOON_WINDOW_MS,
  type MeetingProvider,
  type MeetingViewer,
  type Recurrence,
  type Rsvp,
} from './rules';
import type { MeetingAttendeeDTO, MeetingDTO } from './types';
import {
  deliverMeetingNotification,
  formatMeetingTime,
  publishMeetingChanged,
} from './notifications';
import { closeRoom, isLiveKitConfigured, listRoomIdentities } from './livekit';

const PERSON = { id: true, name: true, email: true, image: true } as const;

export const MEETING_INCLUDE = {
  event: {
    select: {
      id: true,
      title: true,
      description: true,
      location: true,
      startTime: true,
      endTime: true,
      status: true,
      meetingLink: true,
      reminderMinutes: true,
    },
  },
  organizer: { select: PERSON },
  attendees: {
    include: { user: { select: PERSON } },
    orderBy: { createdAt: 'asc' as const },
  },
} as const;

type MeetingRow = any;

// ── Errors ──────────────────────────────────────────────────────────────────

/**
 * True when the team-meetings migration has not been applied yet
 * (missing table/column, or a NotificationType value the database doesn't know).
 */
export function isMeetingsSchemaMissing(error: unknown) {
  const e = error as { code?: string; message?: string } | null;
  if (!e) return false;
  if (e.code === 'P2021' || e.code === 'P2022') return true;
  const msg = typeof e.message === 'string' ? e.message : '';
  return (
    /TeamMeeting|MeetingAttendee/.test(msg) && /does not exist|relation/i.test(msg)
  ) || /invalid input value for enum "NotificationType"/i.test(msg);
}

export const MEETINGS_NOT_READY_MESSAGE =
  'Team meetings need a one-time database update (migration 20261003120000_team_meetings). Ask your workspace owner to apply it.';

function badRequest(message: string) {
  return new ApiException(message, 400, 'BAD_REQUEST');
}

// ── Mapping ─────────────────────────────────────────────────────────────────

function iso(d: Date | string | null | undefined) {
  return d ? new Date(d).toISOString() : null;
}

/** inRoom flags can go stale if a browser dies without the webhook; trust them only near the meeting. */
function liveAttendees(row: MeetingRow, now = new Date()) {
  const end = new Date(row.event.endTime).getTime() + JOIN_GRACE_MS * 3;
  if (now.getTime() > end) return [];
  return (row.attendees as any[]).filter((a) => a.inRoom);
}

export function toMeetingDTO(row: MeetingRow, viewer: MeetingViewer): MeetingDTO {
  const attendeeIds = (row.attendees as any[]).map((a) => a.userId);
  const shape = { organizerId: row.organizerId, attendeeIds };
  const mine = (row.attendees as any[]).find((a) => a.userId === viewer.userId);
  const live = new Set(liveAttendees(row).map((a) => a.userId));
  const attendees: MeetingAttendeeDTO[] = (row.attendees as any[])
    .map((a) => ({
      user: a.user,
      role: a.role === 'ORGANIZER' ? ('ORGANIZER' as const) : ('ATTENDEE' as const),
      rsvp: isRsvp(a.rsvp) ? a.rsvp : 'PENDING',
      respondedAt: iso(a.respondedAt),
      inRoom: live.has(a.userId),
      joinedAt: iso(a.joinedAt),
    }))
    // Organizer first, then going, maybe, awaiting, not going
    .sort((x, y) => rank(x) - rank(y));
  return {
    id: row.id,
    eventId: row.eventId,
    title: row.event.title,
    agenda: row.event.description ?? null,
    location: row.event.location ?? null,
    startTime: iso(row.event.startTime)!,
    endTime: iso(row.event.endTime)!,
    status: row.event.status,
    provider: isProvider(row.provider) ? row.provider : 'OPSLANE',
    meetingLink: row.provider === 'EXTERNAL' ? row.event.meetingLink ?? null : null,
    reminderMinutes: row.event.reminderMinutes ?? null,
    recurrence: isRecurrence(row.recurrence) ? row.recurrence : 'NONE',
    seriesId: row.seriesId ?? null,
    startedAt: iso(row.startedAt),
    endedAt: iso(row.endedAt),
    organizer: row.organizer,
    attendees,
    liveCount: live.size,
    myRsvp: mine ? (isRsvp(mine.rsvp) ? mine.rsvp : 'PENDING') : null,
    isOrganizer: row.organizerId === viewer.userId,
    canManage: canManageMeeting(viewer, shape),
  };
}

function rank(a: MeetingAttendeeDTO) {
  if (a.role === 'ORGANIZER') return 0;
  return { ACCEPTED: 1, TENTATIVE: 2, PENDING: 3, DECLINED: 4 }[a.rsvp];
}

function accessShape(row: MeetingRow) {
  return {
    organizerId: row.organizerId as string,
    attendeeIds: (row.attendees as any[]).map((a) => a.userId as string),
  };
}

// ── Reads ───────────────────────────────────────────────────────────────────

export async function loadMeeting(meetingId: string, companyId: string): Promise<MeetingRow | null> {
  return prisma.teamMeeting.findFirst({
    where: { id: meetingId, companyId },
    include: MEETING_INCLUDE,
  });
}

/** Load + authorize: 404 for meetings the viewer may not see (no existence leak). */
export async function getMeetingForViewer(meetingId: string, companyId: string, viewer: MeetingViewer) {
  const row = await loadMeeting(meetingId, companyId);
  if (!row || !canViewMeeting(viewer, accessShape(row))) {
    throw new ApiException('Meeting not found', 404, 'NOT_FOUND');
  }
  return row;
}

/**
 * When LiveKit is configured, reconcile inRoom flags with who is actually connected
 * (cheap: one RoomService call, only for meetings near their time).
 */
export async function reconcileRoomPresence(row: MeetingRow): Promise<MeetingRow> {
  if (row.provider !== 'OPSLANE' || !isLiveKitConfigured()) return row;
  const now = Date.now();
  const start = new Date(row.event.startTime).getTime();
  const end = new Date(row.event.endTime).getTime();
  if (now < start - SOON_WINDOW_MS * 2 || now > end + JOIN_GRACE_MS * 3) return row;
  const identities = await listRoomIdentities(row.roomName);
  if (!identities) return row;
  const inRoom = new Set(identities);
  const stale = (row.attendees as any[]).filter((a) => a.inRoom !== inRoom.has(a.userId));
  if (stale.length === 0) return row;
  await Promise.all(
    stale.map((a) =>
      prisma.meetingAttendee.update({
        where: { id: a.id },
        data: inRoom.has(a.userId)
          ? { inRoom: true, joinedAt: a.joinedAt ?? new Date() }
          : { inRoom: false, leftAt: new Date() },
      })
    )
  );
  return {
    ...row,
    attendees: (row.attendees as any[]).map((a) => ({ ...a, inRoom: inRoom.has(a.userId) })),
  };
}

export async function listMeetingsForUser(
  companyId: string,
  userId: string,
  scope: 'upcoming' | 'past',
  limit = 50
): Promise<MeetingRow[]> {
  const now = new Date();
  const graceAgo = new Date(now.getTime() - JOIN_GRACE_MS);
  const base = { companyId, attendees: { some: { userId } } };
  if (scope === 'upcoming') {
    return prisma.teamMeeting.findMany({
      where: {
        ...base,
        event: { endTime: { gte: graceAgo }, status: { in: ['SCHEDULED', 'RESCHEDULED'] } },
      },
      include: MEETING_INCLUDE,
      orderBy: { event: { startTime: 'asc' } },
      take: limit,
    });
  }
  return prisma.teamMeeting.findMany({
    where: {
      ...base,
      OR: [
        { event: { endTime: { lt: graceAgo } } },
        { event: { status: { in: ['COMPLETED', 'CANCELLED', 'NO_SHOW'] } } },
      ],
    },
    include: MEETING_INCLUDE,
    orderBy: { event: { startTime: 'desc' } },
    take: limit,
  });
}

/** Header indicator: my meetings that are live or start within the "soon" window. */
export async function meetingsNowForUser(companyId: string, userId: string) {
  const now = new Date();
  const [rows, pendingInvites] = await Promise.all([
    prisma.teamMeeting.findMany({
      where: {
        companyId,
        attendees: { some: { userId, rsvp: { not: 'DECLINED' } } },
        event: {
          status: { in: ['SCHEDULED', 'RESCHEDULED'] },
          startTime: { lte: new Date(now.getTime() + SOON_WINDOW_MS) },
          endTime: { gte: new Date(now.getTime() - JOIN_GRACE_MS) },
        },
      },
      include: MEETING_INCLUDE,
      orderBy: { event: { startTime: 'asc' } },
      take: 10,
    }),
    prisma.meetingAttendee.count({
      where: {
        userId,
        rsvp: 'PENDING',
        role: 'ATTENDEE',
        meeting: {
          companyId,
          event: { status: { in: ['SCHEDULED', 'RESCHEDULED'] }, startTime: { gte: now } },
        },
      },
    }),
  ]);
  // Past the scheduled end, keep only rooms people are still in
  const filtered = rows.filter((row: MeetingRow) => {
    if (row.endedAt && new Date(row.endedAt) >= new Date(row.event.startTime)) return false;
    if (new Date(row.event.endTime) >= now) return true;
    return liveAttendees(row, now).length > 0;
  });
  return { rows: filtered, pendingInvites };
}

/** Meetings the user is invited to (not organizing) in a date range — merged into their calendar. */
export async function invitedMeetingsInRange(
  userId: string,
  range: { startDate?: Date; endDate?: Date },
  companyId?: string
): Promise<MeetingRow[]> {
  const startTime: Record<string, Date> = {};
  if (range.startDate) startTime.gte = range.startDate;
  if (range.endDate) startTime.lte = range.endDate;
  return prisma.teamMeeting.findMany({
    where: {
      ...(companyId ? { companyId } : {}),
      organizerId: { not: userId },
      attendees: { some: { userId, rsvp: { not: 'DECLINED' } } },
      ...(Object.keys(startTime).length ? { event: { startTime } } : {}),
    },
    include: MEETING_INCLUDE,
    take: 500,
  });
}

/** Meeting rows for calendar events the user organizes. */
export async function meetingsForEvents(eventIds: string[]): Promise<MeetingRow[]> {
  if (eventIds.length === 0) return [];
  return prisma.teamMeeting.findMany({
    where: { eventId: { in: eventIds } },
    include: MEETING_INCLUDE,
  });
}

// ── Validation ──────────────────────────────────────────────────────────────

async function validStaffIds(companyId: string, ids: string[]) {
  const unique = Array.from(new Set(ids.filter((id) => typeof id === 'string' && id)));
  if (unique.length === 0) return [];
  if (unique.length > MAX_ATTENDEES) throw badRequest(`Invite at most ${MAX_ATTENDEES} people.`);
  const rows = await prisma.user.findMany({
    where: { id: { in: unique }, userStatus: 'ACTIVE', ...workspaceStaffWhere(companyId) },
    select: { id: true },
  });
  const ok = new Set(rows.map((r: { id: string }) => r.id));
  const invalid = unique.filter((id) => !ok.has(id));
  if (invalid.length) throw badRequest('Some invitees are not members of this workspace.');
  return unique;
}

export type MeetingInput = {
  title?: unknown;
  agenda?: unknown;
  location?: unknown;
  startTime?: unknown;
  endTime?: unknown;
  provider?: unknown;
  meetingLink?: unknown;
  attendeeIds?: unknown;
  reminderMinutes?: unknown;
  recurrence?: unknown;
  occurrences?: unknown;
  /** Actor's browser time zone, only used to word notifications */
  timeZone?: unknown;
};

function parseDate(value: unknown, label: string) {
  const d = typeof value === 'string' || value instanceof Date ? new Date(value) : null;
  if (!d || Number.isNaN(d.getTime())) throw badRequest(`${label} is invalid`);
  return d;
}

function parseReminder(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 7 * 24 * 60) throw badRequest('Reminder is invalid');
  return Math.round(n);
}

function textOrNull(value: unknown, max: number) {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  return v ? v.slice(0, max) : null;
}

function resolveProvider(provider: unknown, link: unknown): { provider: MeetingProvider; link: string | null } {
  const p: MeetingProvider = isProvider(provider) ? provider : 'OPSLANE';
  if (p === 'EXTERNAL') {
    const normalized = normalizeMeetingLink(link);
    if (!normalized) throw badRequest('Add a valid meeting link (https://…)');
    return { provider: p, link: normalized };
  }
  return { provider: p, link: null };
}

// ── Create ──────────────────────────────────────────────────────────────────

export async function createMeeting(
  companyId: string,
  organizer: { id: string; name?: string | null },
  input: MeetingInput
) {
  const title = textOrNull(input.title, 200);
  if (!title) throw badRequest('Title is required');
  const start = parseDate(input.startTime, 'Start time');
  const end = parseDate(input.endTime, 'End time');
  if (end <= start) throw badRequest('End time must be after the start time');
  if (end.getTime() - start.getTime() > 24 * 60 * 60_000) throw badRequest('Meetings can last at most 24 hours');
  const { provider, link } = resolveProvider(input.provider, input.meetingLink);
  const reminderMinutes = parseReminder(input.reminderMinutes);
  const recurrence: Recurrence = isRecurrence(input.recurrence) ? input.recurrence : 'NONE';
  const count = recurrence === 'NONE' ? 1 : Number(input.occurrences) || 4;
  const invitees = (await validStaffIds(
    companyId,
    Array.isArray(input.attendeeIds) ? (input.attendeeIds as string[]) : []
  )).filter((id) => id !== organizer.id);

  const agenda = textOrNull(input.agenda, 5000);
  const location = textOrNull(input.location, 300);
  const duration = end.getTime() - start.getTime();
  const starts = occurrenceStarts(start, recurrence, count);
  const seriesId = starts.length > 1 ? `series_${randomBytes(8).toString('hex')}` : null;

  const created: MeetingRow[] = [];
  for (const occurrenceStart of starts) {
    const row = await prisma.$transaction(async (tx: any) => {
      const event = await tx.calendarEvent.create({
        data: {
          userId: organizer.id,
          title,
          description: agenda,
          location,
          eventType: 'MEETING',
          startTime: occurrenceStart,
          endTime: new Date(occurrenceStart.getTime() + duration),
          meetingLink: link,
          reminderMinutes,
          attendees: [],
        },
      });
      return tx.teamMeeting.create({
        data: {
          eventId: event.id,
          companyId,
          organizerId: organizer.id,
          provider,
          roomName: buildRoomName(companyId, randomBytes(9).toString('base64url')),
          seriesId,
          recurrence,
          attendees: {
            create: [
              { userId: organizer.id, role: 'ORGANIZER', rsvp: 'ACCEPTED', respondedAt: new Date() },
              ...invitees.map((userId) => ({ userId, role: 'ATTENDEE', rsvp: 'PENDING' })),
            ],
          },
        },
        include: MEETING_INCLUDE,
      });
    });
    created.push(row);
  }

  const first = created[0];
  void (async () => {
    if (invitees.length) {
      const when = formatMeetingTime(first.event.startTime, first.event.endTime, textOrNull(input.timeZone, 64));
      const repeat =
        created.length > 1
          ? ` Repeats ${recurrence === 'WEEKDAYS' ? 'every weekday' : recurrence.toLowerCase()} (${created.length} meetings).`
          : '';
      await deliverMeetingNotification({
        type: 'MEETING_INVITE',
        meeting: { id: first.id, companyId, title },
        userIds: invitees,
        title: `${organizer.name || 'A teammate'} invited you: ${title}`,
        body: `${when}.${repeat}`,
        actions: ['rsvp'],
        email: {
          subject: `Invitation: ${title} · ${when}`,
          heading: `${organizer.name || 'A teammate'} invited you to “${title}”`,
          message: `${when}.${repeat} ${provider === 'OPSLANE' ? 'Join from Opslane — no install needed.' : provider === 'EXTERNAL' ? 'The meeting link is in the invitation.' : ''}`.trim(),
          excerpt: agenda,
          ctaLabel: 'Reply to invitation',
        },
      });
    }
    await publishMeetingChanged(first, [organizer.id, ...invitees], organizer.id);
  })().catch((error) => logError(error, { context: 'meeting create notify' }));

  return { first, count: created.length };
}

// ── Update ──────────────────────────────────────────────────────────────────

export async function updateMeeting(
  meetingId: string,
  companyId: string,
  viewer: MeetingViewer & { name?: string | null },
  input: MeetingInput
) {
  const row = await getMeetingForViewer(meetingId, companyId, viewer);
  if (!canManageMeeting(viewer, accessShape(row))) {
    throw new ApiException('Only the organizer can edit this meeting', 403, 'FORBIDDEN');
  }
  if (row.event.status === 'CANCELLED') throw badRequest('This meeting was cancelled');

  const eventData: Record<string, unknown> = {};
  const meetingData: Record<string, unknown> = {};
  if (input.title !== undefined) {
    const title = textOrNull(input.title, 200);
    if (!title) throw badRequest('Title is required');
    eventData.title = title;
  }
  if (input.agenda !== undefined) eventData.description = textOrNull(input.agenda, 5000);
  if (input.location !== undefined) eventData.location = textOrNull(input.location, 300);
  const start = input.startTime !== undefined ? parseDate(input.startTime, 'Start time') : new Date(row.event.startTime);
  const end = input.endTime !== undefined ? parseDate(input.endTime, 'End time') : new Date(row.event.endTime);
  if (end <= start) throw badRequest('End time must be after the start time');
  const timeChanged =
    start.getTime() !== new Date(row.event.startTime).getTime() ||
    end.getTime() !== new Date(row.event.endTime).getTime();
  if (timeChanged) {
    eventData.startTime = start;
    eventData.endTime = end;
  }
  if (input.reminderMinutes !== undefined) eventData.reminderMinutes = parseReminder(input.reminderMinutes);
  let linkChanged = false;
  if (input.provider !== undefined || input.meetingLink !== undefined) {
    const { provider, link } = resolveProvider(input.provider ?? row.provider, input.meetingLink ?? row.event.meetingLink);
    linkChanged = provider !== row.provider || link !== (row.event.meetingLink ?? null);
    meetingData.provider = provider;
    eventData.meetingLink = link;
  }

  const currentIds = new Set<string>((row.attendees as any[]).map((a) => a.userId));
  let added: string[] = [];
  let removed: string[] = [];
  if (input.attendeeIds !== undefined) {
    const next = new Set(
      (await validStaffIds(companyId, Array.isArray(input.attendeeIds) ? (input.attendeeIds as string[]) : [])).filter(
        (id) => id !== row.organizerId
      )
    );
    next.add(row.organizerId);
    added = Array.from(next).filter((id) => !currentIds.has(id));
    removed = Array.from(currentIds).filter((id) => !next.has(id) && id !== row.organizerId);
  }

  await prisma.$transaction(async (tx: any) => {
    if (Object.keys(eventData).length) {
      await tx.calendarEvent.update({ where: { id: row.eventId }, data: eventData });
    }
    if (Object.keys(meetingData).length) {
      await tx.teamMeeting.update({ where: { id: row.id }, data: meetingData });
    }
    if (removed.length) {
      await tx.meetingAttendee.deleteMany({ where: { meetingId: row.id, userId: { in: removed } } });
    }
    if (added.length) {
      await tx.meetingAttendee.createMany({
        data: added.map((userId) => ({ meetingId: row.id, userId, role: 'ATTENDEE', rsvp: 'PENDING' })),
        skipDuplicates: true,
      });
    }
    if (timeChanged) {
      // New time → new reminder, and a fresh answer from everyone but the organizer
      await tx.meetingAttendee.updateMany({ where: { meetingId: row.id }, data: { reminderSentAt: null } });
      await tx.meetingAttendee.updateMany({
        where: { meetingId: row.id, role: 'ATTENDEE', rsvp: { not: 'PENDING' } },
        data: { rsvp: 'PENDING', respondedAt: null },
      });
      await tx.teamMeeting.update({ where: { id: row.id }, data: { endedAt: null } });
    }
  });

  const updated = await loadMeeting(row.id, companyId);
  const title = updated.event.title as string;
  const zone = textOrNull(input.timeZone, 64);
  const when = formatMeetingTime(updated.event.startTime, updated.event.endTime, zone);
  const actor = viewer.name || 'The organizer';
  const ref = { id: row.id, companyId, title };
  const kept = Array.from(currentIds).filter((id) => id !== viewer.userId && !removed.includes(id));

  void (async () => {
    if (added.length) {
      await deliverMeetingNotification({
        type: 'MEETING_INVITE',
        meeting: ref,
        userIds: added.filter((id) => id !== viewer.userId),
        title: `${actor} invited you: ${title}`,
        body: `${when}.`,
        actions: ['rsvp'],
        email: {
          subject: `Invitation: ${title} · ${when}`,
          heading: `${actor} invited you to “${title}”`,
          message: `${when}.`,
          excerpt: updated.event.description,
          ctaLabel: 'Reply to invitation',
        },
      });
    }
    if (removed.length) {
      await deliverMeetingNotification({
        type: 'MEETING_CANCELLED',
        meeting: ref,
        userIds: removed,
        title: `You were removed from ${title}`,
        body: `${actor} updated the guest list for ${when}.`,
      });
    }
    if (kept.length && (timeChanged || linkChanged || eventData.title)) {
      const what = timeChanged ? `Now ${when}. Please confirm you can still make it.` : linkChanged ? 'The meeting link changed.' : `Details changed for ${when}.`;
      await deliverMeetingNotification({
        type: 'MEETING_UPDATED',
        meeting: ref,
        userIds: kept,
        title: `${timeChanged ? 'Rescheduled' : 'Updated'}: ${title}`,
        body: what,
        actions: timeChanged ? ['rsvp'] : [],
        email: timeChanged || linkChanged
          ? {
              subject: `${timeChanged ? 'Rescheduled' : 'Updated'}: ${title} · ${when}`,
              heading: `${actor} ${timeChanged ? 'moved' : 'updated'} “${title}”`,
              message: what,
              ctaLabel: 'Open meeting',
            }
          : undefined,
      });
    }
    await publishMeetingChanged(ref, [...Array.from(currentIds), ...added], viewer.userId);
  })().catch((error) => logError(error, { context: 'meeting update notify' }));

  return updated;
}

// ── Cancel / end ────────────────────────────────────────────────────────────

export async function cancelMeeting(
  meetingId: string,
  companyId: string,
  viewer: MeetingViewer & { name?: string | null },
  opts: { series?: boolean; timeZone?: string | null } = {}
) {
  const row = await getMeetingForViewer(meetingId, companyId, viewer);
  if (!canManageMeeting(viewer, accessShape(row))) {
    throw new ApiException('Only the organizer can cancel this meeting', 403, 'FORBIDDEN');
  }
  const targets: MeetingRow[] =
    opts.series && row.seriesId
      ? await prisma.teamMeeting.findMany({
          where: {
            companyId,
            seriesId: row.seriesId,
            event: { startTime: { gte: row.event.startTime }, status: { not: 'CANCELLED' } },
          },
          include: MEETING_INCLUDE,
        })
      : [row];

  await prisma.calendarEvent.updateMany({
    where: { id: { in: targets.map((t) => t.eventId) } },
    data: { status: 'CANCELLED' },
  });
  await prisma.meetingAttendee.updateMany({
    where: { meetingId: { in: targets.map((t) => t.id) } },
    data: { inRoom: false },
  });
  for (const t of targets) if (t.provider === 'OPSLANE') void closeRoom(t.roomName);

  const title = row.event.title as string;
  const recipients = (row.attendees as any[]).map((a) => a.userId).filter((id: string) => id !== viewer.userId);
  const when = formatMeetingTime(row.event.startTime, row.event.endTime, opts.timeZone);
  const ref = { id: row.id, companyId, title };
  void (async () => {
    await deliverMeetingNotification({
      type: 'MEETING_CANCELLED',
      meeting: ref,
      userIds: recipients,
      title: `Cancelled: ${title}`,
      body:
        targets.length > 1
          ? `${viewer.name || 'The organizer'} cancelled this and ${targets.length - 1} later meeting${targets.length > 2 ? 's' : ''} in the series.`
          : `${viewer.name || 'The organizer'} cancelled the meeting on ${when}.`,
      email: {
        subject: `Cancelled: ${title} · ${when}`,
        heading: `“${title}” was cancelled`,
        message:
          targets.length > 1
            ? `${viewer.name || 'The organizer'} cancelled ${targets.length} meetings in this series, starting ${when}.`
            : `${viewer.name || 'The organizer'} cancelled the meeting on ${when}.`,
        ctaLabel: 'View in Opslane',
      },
    });
    await publishMeetingChanged(ref, [viewer.userId, ...recipients], viewer.userId);
  })().catch((error) => logError(error, { context: 'meeting cancel notify' }));

  return { cancelled: targets.length };
}

/** "End for everyone": close the room, mark the event completed. */
export async function endMeeting(meetingId: string, companyId: string, viewer: MeetingViewer) {
  const row = await getMeetingForViewer(meetingId, companyId, viewer);
  if (!canManageMeeting(viewer, accessShape(row))) {
    throw new ApiException('Only the organizer can end this meeting for everyone', 403, 'FORBIDDEN');
  }
  const now = new Date();
  await prisma.$transaction([
    prisma.teamMeeting.update({ where: { id: row.id }, data: { endedAt: now } }),
    prisma.meetingAttendee.updateMany({ where: { meetingId: row.id, inRoom: true }, data: { inRoom: false, leftAt: now } }),
    prisma.calendarEvent.update({
      where: { id: row.eventId },
      data: { status: 'COMPLETED', ...(new Date(row.event.endTime) > now ? { endTime: now } : {}) },
    }),
  ]);
  if (row.provider === 'OPSLANE') await closeRoom(row.roomName);
  await publishMeetingChanged(row, accessShape(row).attendeeIds, viewer.userId);
}

// ── RSVP ────────────────────────────────────────────────────────────────────

export async function respondToMeeting(
  meetingId: string,
  companyId: string,
  viewer: MeetingViewer & { name?: string | null },
  rsvp: unknown
) {
  if (!isRsvp(rsvp) || rsvp === 'PENDING') throw badRequest('Choose Going, Maybe or Not going');
  const row = await getMeetingForViewer(meetingId, companyId, viewer);
  if (!canRespond(viewer, accessShape(row))) {
    throw new ApiException('Only invited people can reply to this meeting', 403, 'FORBIDDEN');
  }
  if (row.event.status === 'CANCELLED') throw badRequest('This meeting was cancelled');
  const mine = (row.attendees as any[]).find((a) => a.userId === viewer.userId);
  if (mine.rsvp !== rsvp) {
    await prisma.meetingAttendee.update({
      where: { id: mine.id },
      data: { rsvp, respondedAt: new Date() },
    });
    const title = row.event.title as string;
    const verb = rsvp === 'ACCEPTED' ? 'is going to' : rsvp === 'DECLINED' ? 'declined' : 'might attend';
    void deliverMeetingNotification({
      type: 'MEETING_RSVP',
      meeting: { id: row.id, companyId, title },
      userIds: [row.organizerId],
      title: `${viewer.name || 'A teammate'} ${verb} ${title}`,
      body: `Reply: ${RSVP_LABEL[rsvp as Rsvp]}.`,
    });
    void publishMeetingChanged(row, accessShape(row).attendeeIds, viewer.userId);
  }
  return loadMeeting(row.id, companyId);
}

// ── Room presence ───────────────────────────────────────────────────────────

/**
 * Someone entered the room (token minted, or LiveKit webhook). First entry stamps
 * startedAt and tells everyone else who is going that the meeting has started.
 */
export async function markJoined(row: MeetingRow, user: { id: string; name?: string | null }) {
  const now = new Date();
  await prisma.meetingAttendee.updateMany({
    where: { meetingId: row.id, userId: user.id },
    data: { inRoom: true, joinedAt: now },
  });
  const first = await prisma.teamMeeting.updateMany({
    where: { id: row.id, startedAt: null },
    data: { startedAt: now },
  });
  // Reopening a room after "End for everyone" (organizer/admin only, see checkCanJoin)
  if (row.endedAt) {
    await prisma.teamMeeting.update({ where: { id: row.id }, data: { endedAt: null } });
  }
  const ids = accessShape(row).attendeeIds;
  if (first.count > 0) {
    const waiting = (row.attendees as any[])
      .filter((a) => a.userId !== user.id && a.rsvp !== 'DECLINED')
      .map((a) => a.userId);
    void deliverMeetingNotification({
      type: 'MEETING_STARTED',
      meeting: { id: row.id, companyId: row.companyId, title: row.event.title },
      userIds: waiting,
      title: `${row.event.title} has started`,
      body: `${user.name || 'A teammate'} is in the room. Join now.`,
      actions: ['join'],
    });
  }
  void publishMeetingChanged(row, ids, user.id);
}

export async function markLeft(row: MeetingRow, userId: string) {
  await prisma.meetingAttendee.updateMany({
    where: { meetingId: row.id, userId, inRoom: true },
    data: { inRoom: false, leftAt: new Date() },
  });
  void publishMeetingChanged(row, accessShape(row).attendeeIds, userId);
}

// ── Reminders ───────────────────────────────────────────────────────────────

/**
 * Send due reminders (idempotent: each attendee row is claimed with reminderSentAt
 * before notifying). Runs from /api/cron/meeting-reminders and opportunistically
 * from the header poll (scoped to one workspace) so reminders work on daily-cron plans.
 */
export async function sendDueMeetingReminders(opts: { companyId?: string; now?: Date; limit?: number } = {}) {
  const now = opts.now ?? new Date();
  const horizon = new Date(now.getTime() + 7 * 24 * 60 * 60_000);
  const candidates = await prisma.meetingAttendee.findMany({
    where: {
      reminderSentAt: null,
      rsvp: { not: 'DECLINED' },
      meeting: {
        ...(opts.companyId ? { companyId: opts.companyId } : {}),
        event: {
          status: { in: ['SCHEDULED', 'RESCHEDULED'] },
          startTime: { gte: new Date(now.getTime() - 5 * 60_000), lte: horizon },
        },
      },
    },
    select: {
      id: true,
      userId: true,
      rsvp: true,
      reminderSentAt: true,
      meeting: {
        select: {
          id: true,
          companyId: true,
          provider: true,
          event: { select: { title: true, startTime: true, endTime: true, status: true, reminderMinutes: true } },
        },
      },
    },
    take: opts.limit ?? 300,
  });

  let sent = 0;
  for (const c of candidates as any[]) {
    const due = isReminderDue(
      {
        startTime: c.meeting.event.startTime,
        reminderMinutes: c.meeting.event.reminderMinutes,
        reminderSentAt: c.reminderSentAt,
        rsvp: c.rsvp,
        status: c.meeting.event.status,
      },
      now
    );
    if (!due) continue;
    const claim = await prisma.meetingAttendee.updateMany({
      where: { id: c.id, reminderSentAt: null },
      data: { reminderSentAt: now },
    });
    if (claim.count === 0) continue;
    sent += 1;
    const lead = reminderLeadMinutes(c.meeting.event.reminderMinutes);
    const minutes = Math.max(0, Math.round((new Date(c.meeting.event.startTime).getTime() - now.getTime()) / 60_000));
    const when = minutes <= 0 ? 'now' : `in ${minutes} min`;
    const title = c.meeting.event.title as string;
    await deliverMeetingNotification({
      type: 'MEETING_REMINDER',
      meeting: { id: c.meeting.id, companyId: c.meeting.companyId, title },
      userIds: [c.userId],
      title: `${title} starts ${when}`,
      body:
        c.meeting.provider === 'NONE'
          ? formatMeetingTime(c.meeting.event.startTime, c.meeting.event.endTime)
          : `${formatMeetingTime(c.meeting.event.startTime, c.meeting.event.endTime)} · Join from Opslane.`,
      actions: c.meeting.provider === 'NONE' ? [] : ['join'],
      // Short-notice reminders are in-app only; longer ones also email
      email:
        lead >= 30
          ? {
              subject: `Reminder: ${title} starts ${when}`,
              heading: `“${title}” starts ${when}`,
              message: formatMeetingTime(c.meeting.event.startTime, c.meeting.event.endTime),
              ctaLabel: 'Open meeting',
            }
          : undefined,
    });
  }
  return { checked: candidates.length, sent };
}
