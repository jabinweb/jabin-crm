import {
  buildRoomName,
  canManageMeeting,
  canRespond,
  canViewMeeting,
  checkCanJoin,
  decideRoomToken,
  isReminderDue,
  meetingPhase,
  normalizeMeetingLink,
  occurrenceStarts,
  reminderLeadMinutes,
  startsInLabel,
  summarizeRsvps,
  type MeetingViewer,
} from '@/lib/meetings/rules';

const START = new Date('2026-10-05T10:00:00.000Z');
const END = new Date('2026-10-05T10:30:00.000Z');
const at = (iso: string) => new Date(iso);

const meeting = {
  organizerId: 'org',
  attendeeIds: ['org', 'ann', 'bob'],
  provider: 'OPSLANE',
  status: 'SCHEDULED',
  startTime: START,
  endTime: END,
  endedAt: null as Date | null,
};

const staff = (userId: string, role = 'SALES'): MeetingViewer => ({ userId, role, isWorkspaceStaff: true });

describe('meeting access', () => {
  it('lets the organizer and invitees see the meeting', () => {
    expect(canViewMeeting(staff('org'), meeting)).toBe(true);
    expect(canViewMeeting(staff('ann'), meeting)).toBe(true);
  });

  it('hides it from uninvited staff but not from workspace admins', () => {
    expect(canViewMeeting(staff('eve'), meeting)).toBe(false);
    expect(canViewMeeting(staff('adm', 'ADMIN'), meeting)).toBe(true);
    expect(canViewMeeting(staff('sup', 'SUPER_ADMIN'), meeting)).toBe(true);
  });

  it('never lets customers or other workspaces in, even if listed', () => {
    expect(canViewMeeting({ userId: 'ann', role: 'CUSTOMER', isWorkspaceStaff: true }, meeting)).toBe(false);
    expect(canViewMeeting({ userId: 'ann', role: 'SALES', isWorkspaceStaff: false }, meeting)).toBe(false);
    expect(canViewMeeting({ userId: 'adm', role: 'ADMIN', isWorkspaceStaff: false }, meeting)).toBe(false);
  });

  it('only the organizer and admins manage; only invitees reply', () => {
    expect(canManageMeeting(staff('org'), meeting)).toBe(true);
    expect(canManageMeeting(staff('adm', 'ADMIN'), meeting)).toBe(true);
    expect(canManageMeeting(staff('ann'), meeting)).toBe(false);
    expect(canRespond(staff('ann'), meeting)).toBe(true);
    expect(canRespond(staff('org'), meeting)).toBe(false);
    expect(canRespond(staff('adm', 'ADMIN'), meeting)).toBe(false);
  });
});

describe('join window', () => {
  it('opens 15 minutes early and stays open an hour after the end', () => {
    expect(checkCanJoin(staff('ann'), meeting, at('2026-10-05T09:44:00Z')).ok).toBe(false);
    expect(checkCanJoin(staff('ann'), meeting, at('2026-10-05T09:46:00Z')).ok).toBe(true);
    expect(checkCanJoin(staff('ann'), meeting, at('2026-10-05T11:29:00Z')).ok).toBe(true);
    expect(checkCanJoin(staff('ann'), meeting, at('2026-10-05T11:31:00Z')).ok).toBe(false);
  });

  it('lets the organizer reopen a finished or ended room', () => {
    expect(checkCanJoin(staff('org'), meeting, at('2026-10-05T13:00:00Z')).ok).toBe(true);
    const ended = { ...meeting, endedAt: at('2026-10-05T10:20:00Z') };
    expect(checkCanJoin(staff('ann'), ended, at('2026-10-05T10:21:00Z')).ok).toBe(false);
    expect(checkCanJoin(staff('org'), ended, at('2026-10-05T10:21:00Z')).ok).toBe(true);
  });

  it('refuses cancelled meetings and outsiders', () => {
    const cancelled = { ...meeting, status: 'CANCELLED' };
    expect(checkCanJoin(staff('ann'), cancelled, at('2026-10-05T10:05:00Z'))).toMatchObject({ ok: false, status: 409 });
    expect(checkCanJoin(staff('eve'), meeting, at('2026-10-05T10:05:00Z'))).toMatchObject({ ok: false, status: 403 });
  });
});

describe('decideRoomToken (guard in front of LiveKit token minting)', () => {
  const during = at('2026-10-05T10:05:00Z');

  it('answers 404 for people who are not invited (no existence leak)', () => {
    expect(
      decideRoomToken({ viewer: staff('eve'), meeting, liveKitConfigured: true, now: during })
    ).toEqual({ ok: false, status: 404, error: 'Meeting not found' });
  });

  it('refuses customers even with a valid attendee id', () => {
    const d = decideRoomToken({
      viewer: { userId: 'ann', role: 'CUSTOMER', isWorkspaceStaff: true },
      meeting,
      liveKitConfigured: true,
      now: during,
    });
    expect(d.ok).toBe(false);
  });

  it('does not mint for external-link meetings', () => {
    const d = decideRoomToken({ viewer: staff('ann'), meeting: { ...meeting, provider: 'EXTERNAL' }, liveKitConfigured: true, now: during });
    expect(d).toMatchObject({ ok: false, status: 409, code: 'EXTERNAL_MEETING' });
  });

  it('degrades with a clear code when LiveKit is not configured', () => {
    const d = decideRoomToken({ viewer: staff('ann'), meeting, liveKitConfigured: false, now: during });
    expect(d).toMatchObject({ ok: false, status: 503, code: 'VIDEO_NOT_CONFIGURED' });
  });

  it('respects the join window', () => {
    const d = decideRoomToken({ viewer: staff('ann'), meeting, liveKitConfigured: true, now: at('2026-10-04T10:00:00Z') });
    expect(d).toMatchObject({ ok: false, status: 409 });
  });

  it('grants room admin only to the organizer and workspace admins', () => {
    expect(decideRoomToken({ viewer: staff('ann'), meeting, liveKitConfigured: true, now: during })).toEqual({ ok: true, roomAdmin: false });
    expect(decideRoomToken({ viewer: staff('org'), meeting, liveKitConfigured: true, now: during })).toEqual({ ok: true, roomAdmin: true });
    expect(decideRoomToken({ viewer: staff('adm', 'ADMIN'), meeting, liveKitConfigured: true, now: during })).toEqual({ ok: true, roomAdmin: true });
  });
});

describe('meeting phase', () => {
  it('moves upcoming → soon → live → ended', () => {
    expect(meetingPhase(meeting, at('2026-10-05T09:00:00Z'))).toBe('upcoming');
    expect(meetingPhase(meeting, at('2026-10-05T09:50:00Z'))).toBe('soon');
    expect(meetingPhase(meeting, at('2026-10-05T10:10:00Z'))).toBe('live');
    expect(meetingPhase(meeting, at('2026-10-05T10:40:00Z'))).toBe('ended');
  });

  it('stays live while people are still in the room after the scheduled end', () => {
    expect(meetingPhase({ ...meeting, liveCount: 2 }, at('2026-10-05T10:50:00Z'))).toBe('live');
  });

  it('shows cancelled and explicitly ended meetings as such', () => {
    expect(meetingPhase({ ...meeting, status: 'CANCELLED' }, at('2026-10-05T10:10:00Z'))).toBe('cancelled');
    expect(meetingPhase({ ...meeting, endedAt: at('2026-10-05T10:15:00Z') }, at('2026-10-05T10:16:00Z'))).toBe('ended');
  });

  it('formats a short countdown', () => {
    expect(startsInLabel(START, at('2026-10-05T09:55:00Z'))).toBe('in 5 min');
    expect(startsInLabel(START, at('2026-10-05T07:00:00Z'))).toBe('in 3 h');
    expect(startsInLabel(START, at('2026-10-05T10:00:10Z'))).toBe('now');
  });
});

describe('RSVP summary', () => {
  it('counts replies and treats unknown values as pending', () => {
    expect(
      summarizeRsvps([{ rsvp: 'ACCEPTED' }, { rsvp: 'ACCEPTED' }, { rsvp: 'DECLINED' }, { rsvp: 'weird' }, { rsvp: 'TENTATIVE' }])
    ).toEqual({ ACCEPTED: 2, DECLINED: 1, PENDING: 1, TENTATIVE: 1, total: 5 });
  });
});

describe('reminders', () => {
  const base = { startTime: START, reminderMinutes: 10, reminderSentAt: null, rsvp: 'ACCEPTED', status: 'SCHEDULED' };

  it('is due inside the lead window only', () => {
    expect(isReminderDue(base, at('2026-10-05T09:49:00Z'))).toBe(false);
    expect(isReminderDue(base, at('2026-10-05T09:50:00Z'))).toBe(true);
    expect(isReminderDue(base, at('2026-10-05T10:03:00Z'))).toBe(true);
    expect(isReminderDue(base, at('2026-10-05T10:06:00Z'))).toBe(false);
  });

  it('skips sent, declined, cancelled and disabled reminders', () => {
    const t = at('2026-10-05T09:55:00Z');
    expect(isReminderDue({ ...base, reminderSentAt: t }, t)).toBe(false);
    expect(isReminderDue({ ...base, rsvp: 'DECLINED' }, t)).toBe(false);
    expect(isReminderDue({ ...base, status: 'CANCELLED' }, t)).toBe(false);
    expect(isReminderDue({ ...base, reminderMinutes: 0 }, t)).toBe(false);
  });

  it('defaults to 10 minutes and caps at a week', () => {
    expect(reminderLeadMinutes(null)).toBe(10);
    expect(reminderLeadMinutes(-5)).toBe(10);
    expect(reminderLeadMinutes(60 * 24 * 30)).toBe(60 * 24 * 7);
  });
});

describe('recurrence', () => {
  it('creates weekly occurrences at the same time', () => {
    const starts = occurrenceStarts(new Date(2026, 9, 5, 10, 0), 'WEEKLY', 3);
    expect(starts.map((d) => [d.getDate(), d.getHours()])).toEqual([
      [5, 10],
      [12, 10],
      [19, 10],
    ]);
  });

  it('skips weekends for weekday meetings', () => {
    // Fri 9 Oct 2026 → Mon 12, Tue 13
    const starts = occurrenceStarts(new Date(2026, 9, 9, 9, 30), 'WEEKDAYS', 3);
    expect(starts.map((d) => d.getDay())).toEqual([5, 1, 2]);
  });

  it('caps the number of occurrences and ignores count for one-off meetings', () => {
    expect(occurrenceStarts(START, 'DAILY', 500)).toHaveLength(26);
    expect(occurrenceStarts(START, 'NONE', 5)).toHaveLength(1);
  });
});

describe('links and room names', () => {
  it('accepts http(s) meeting links only', () => {
    expect(normalizeMeetingLink(' https://meet.google.com/abc-defg-hij ')).toBe('https://meet.google.com/abc-defg-hij');
    expect(normalizeMeetingLink('javascript:alert(1)')).toBeNull();
    expect(normalizeMeetingLink('data:text/html,hi')).toBeNull();
    expect(normalizeMeetingLink('not a url')).toBeNull();
    expect(normalizeMeetingLink('')).toBeNull();
  });

  it('builds safe room names', () => {
    const name = buildRoomName('cmp_1234567890abcdef', 'a+b/c=d_e-f');
    expect(name).toMatch(/^opslane-[A-Za-z0-9_-]+$/);
    expect(name).toContain('90abcdef');
  });
});
