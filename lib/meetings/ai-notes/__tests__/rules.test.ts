import {
  buildActionItems,
  canContributeAudio,
  canControlNotes,
  canViewNotes,
  checkClipAccepted,
  clampClipStart,
  cleanClipText,
  formatTranscript,
  matchOwner,
  MAX_CLIP_BYTES,
  mergeActionItems,
  normalizeDueDate,
  parseNotesResponse,
  readActionItems,
  type ActionItem,
} from '../rules';
import { shouldSendClip } from '../audio';
import { canRoleUseTool } from '@/lib/agent/tool-access';

const PEOPLE = [
  { id: 'u1', name: 'Asha Kumari', email: 'asha@acme.test' },
  { id: 'u2', name: 'Ravi Shah', email: 'ravi.shah@acme.test' },
  { id: 'u3', name: 'Ravi Menon', email: 'rmenon@acme.test' },
  { id: 'u4', name: null, email: 'john.doe@acme.test' },
];

describe('parseNotesResponse', () => {
  it('parses the expected JSON shape', () => {
    const parsed = parseNotesResponse(
      JSON.stringify({
        summary: 'We agreed on the launch plan.',
        keyPoints: ['Launch on the 14th', '  Budget approved  '],
        actionItems: [
          { text: 'Send the brief to the client', owner: 'Asha', dueDate: '2026-10-10' },
          { text: 'Book the venue', owner: null, dueDate: null },
        ],
      })
    );
    expect(parsed).toEqual({
      summary: 'We agreed on the launch plan.',
      keyPoints: ['Launch on the 14th', 'Budget approved'],
      actionItems: [
        { text: 'Send the brief to the client', owner: 'Asha', dueDate: '2026-10-10' },
        { text: 'Book the venue', owner: null, dueDate: null },
      ],
    });
  });

  it('tolerates code fences, prose around the JSON and alternative keys', () => {
    const raw = 'Here are the notes:\n```json\n{"summary":"S","bullets":["a"],"action_items":[{"task":"Do X","assignee":"Ravi Shah","due":"2026-02-30"},"Call the bank"]}\n```';
    const parsed = parseNotesResponse(raw)!;
    expect(parsed.keyPoints).toEqual(['a']);
    // Feb 30 is not a real date → dropped
    expect(parsed.actionItems).toEqual([
      { text: 'Do X', owner: 'Ravi Shah', dueDate: null },
      { text: 'Call the bank', owner: null, dueDate: null },
    ]);
  });

  it('treats placeholder owners as no owner', () => {
    const parsed = parseNotesResponse('{"summary":"x","actionItems":[{"text":"a","owner":"Team"},{"text":"b","owner":"unknown"}]}')!;
    expect(parsed.actionItems.map((i) => i.owner)).toEqual([null, null]);
  });

  it('returns null for garbage or empty notes', () => {
    expect(parseNotesResponse('not json at all')).toBeNull();
    expect(parseNotesResponse('{"summary":"","keyPoints":[],"actionItems":[]}')).toBeNull();
    expect(parseNotesResponse('[1,2]')).toBeNull();
    expect(parseNotesResponse(null)).toBeNull();
  });

  it('caps list sizes', () => {
    const many = Array.from({ length: 50 }, (_, i) => ({ text: `item ${i}` }));
    const parsed = parseNotesResponse(JSON.stringify({ summary: 's', keyPoints: many.map((m) => m.text), actionItems: many }))!;
    expect(parsed.keyPoints).toHaveLength(15);
    expect(parsed.actionItems).toHaveLength(30);
  });
});

describe('normalizeDueDate', () => {
  it('accepts real dates only', () => {
    expect(normalizeDueDate('2026-10-31')).toBe('2026-10-31');
    expect(normalizeDueDate('2026-10-31T10:00:00Z')).toBe('2026-10-31');
    expect(normalizeDueDate('2026-13-01')).toBeNull();
    expect(normalizeDueDate('next Friday')).toBeNull();
    expect(normalizeDueDate(42)).toBeNull();
  });
});

describe('matchOwner', () => {
  it('matches exact full names and emails (case/accents ignored)', () => {
    expect(matchOwner('asha kumari', PEOPLE)?.id).toBe('u1');
    expect(matchOwner('Ásha Kumari', PEOPLE)?.id).toBe('u1');
    expect(matchOwner('ravi.shah@acme.test', PEOPLE)?.id).toBe('u2');
  });

  it('matches a unique first name, email local part or last name', () => {
    expect(matchOwner('Asha', PEOPLE)?.id).toBe('u1');
    expect(matchOwner('johndoe', PEOPLE)?.id).toBe('u4');
    expect(matchOwner('Menon', PEOPLE)?.id).toBe('u3');
  });

  it('refuses ambiguous or unknown names', () => {
    expect(matchOwner('Ravi', PEOPLE)).toBeNull();
    expect(matchOwner('Priya', PEOPLE)).toBeNull();
    expect(matchOwner('', PEOPLE)).toBeNull();
    expect(matchOwner(null, PEOPLE)).toBeNull();
  });

  it('uses the last initial to split people sharing a first name', () => {
    expect(matchOwner('Ravi S', PEOPLE)?.id).toBe('u2');
    expect(matchOwner('Ravi M.', PEOPLE)?.id).toBe('u3');
  });
});

describe('buildActionItems / mergeActionItems', () => {
  let n = 0;
  const makeId = () => `id${++n}`;

  it('resolves owners to attendees and keeps unresolved spoken names', () => {
    const items = buildActionItems(
      [
        { text: 'Send brief', owner: 'Asha', dueDate: '2026-10-10' },
        { text: 'Check numbers', owner: 'Ravi', dueDate: null },
      ],
      PEOPLE,
      makeId
    );
    expect(items[0]).toMatchObject({ ownerUserId: 'u1', ownerName: 'Asha Kumari', dueDate: '2026-10-10', done: false });
    expect(items[1]).toMatchObject({ ownerUserId: null, ownerName: 'Ravi' });
  });

  it('keeps ticked and converted items across a regenerate', () => {
    const previous: ActionItem[] = [
      { id: 'a', text: 'Send the brief!', done: true },
      { id: 'b', text: 'Book venue', followUpId: 't1' },
      { id: 'c', text: 'Untouched old item' },
    ];
    const next: ActionItem[] = [
      { id: 'x', text: 'send the brief', ownerUserId: 'u1' },
      { id: 'y', text: 'New item' },
    ];
    const merged = mergeActionItems(previous, next);
    expect(merged).toEqual([
      expect.objectContaining({ id: 'a', text: 'send the brief', done: true, ownerUserId: 'u1' }),
      expect.objectContaining({ id: 'y', text: 'New item' }),
      expect.objectContaining({ id: 'b', followUpId: 't1' }),
    ]);
    expect(merged.some((i) => i.id === 'c')).toBe(false);
  });

  it('reads stored JSON defensively', () => {
    expect(readActionItems(null)).toEqual([]);
    expect(readActionItems([{ id: 'a', text: 't', done: 'yes', dueDate: 'soon' }, { nope: true }, 'x'])).toEqual([
      expect.objectContaining({ id: 'a', text: 't', done: false, dueDate: null }),
    ]);
  });
});

describe('transcript helpers', () => {
  it('cleans silence markers and fences', () => {
    expect(cleanClipText('[silence]')).toBe('');
    expect(cleanClipText('  Silence. ')).toBe('');
    expect(cleanClipText('```\nHello there [laughter] team\n```')).toBe('Hello there team');
  });

  it('orders lines by clip start, not upload order, with relative times', () => {
    const t0 = new Date('2026-10-04T10:00:00Z').getTime();
    const text = formatTranscript(
      [
        { speakerId: 'u2', speakerName: 'Ravi', startedAt: new Date(t0 + 30_000), text: 'Second' },
        { speakerId: 'u1', speakerName: 'Asha', startedAt: new Date(t0 + 5_000), text: 'First\nline' },
        { speakerId: 'u1', speakerName: 'Asha', startedAt: new Date(t0 + 3_725_000), text: 'Later' },
      ],
      new Date(t0)
    );
    expect(text.split('\n')).toEqual(['[00:05] Asha: First line', '[00:30] Ravi: Second', '[1:02:05] Asha: Later']);
  });

  it('clamps client clip times into the meeting', () => {
    const now = new Date('2026-10-04T10:30:00Z');
    const start = new Date('2026-10-04T10:00:00Z');
    expect(clampClipStart(String(now.getTime() - 25_000), 25_000, start, now).getTime()).toBe(now.getTime() - 25_000);
    // In the future → now; years ago → an hour before the start; junk → now - duration
    expect(clampClipStart(now.getTime() + 60_000, 25_000, start, now).getTime()).toBe(now.getTime());
    expect(clampClipStart(1, 25_000, start, now).getTime()).toBe(start.getTime() - 3_600_000);
    expect(clampClipStart('abc', 25_000, start, now).getTime()).toBe(now.getTime() - 25_000);
  });

  it('skips silent or quiet non-speech clips', () => {
    expect(shouldSendClip(0.001, true)).toBe(false);
    expect(shouldSendClip(0.01, false)).toBe(false);
    expect(shouldSendClip(0.01, true)).toBe(true);
    expect(shouldSendClip(0.05, false)).toBe(true);
  });
});

describe('access', () => {
  const meeting = { organizerId: 'org', attendeeIds: ['org', 'att'] };
  const staff = (userId: string, role = 'SALES') => ({ userId, role, isWorkspaceStaff: true });

  it('lets the organizer and admins control notes, not attendees', () => {
    expect(canControlNotes(staff('org'), meeting)).toBe(true);
    expect(canControlNotes(staff('admin', 'ADMIN'), meeting)).toBe(true);
    expect(canControlNotes(staff('att'), meeting)).toBe(false);
  });

  it('lets attendees (and admins) view and contribute; outsiders and customers never', () => {
    expect(canViewNotes(staff('att'), meeting)).toBe(true);
    expect(canContributeAudio(staff('att'), meeting)).toBe(true);
    expect(canContributeAudio(staff('admin', 'ADMIN'), meeting)).toBe(true);
    expect(canViewNotes(staff('outsider'), meeting)).toBe(false);
    expect(canContributeAudio(staff('outsider'), meeting)).toBe(false);
    expect(canViewNotes({ userId: 'att', role: 'CUSTOMER', isWorkspaceStaff: false }, meeting)).toBe(false);
    expect(canContributeAudio({ userId: 'att', role: 'SALES', isWorkspaceStaff: false }, meeting)).toBe(false);
  });

  it('gates clip uploads on switch, meeting state, size, type and volume', () => {
    const base = {
      notesEnabled: true,
      meetingStatus: 'SCHEDULED',
      provider: 'OPSLANE',
      endedAt: null,
      startTime: '2026-10-04T10:00:00Z',
      segmentCount: 0,
      size: 500_000,
      mediaType: 'audio/wav',
      now: new Date('2026-10-04T10:10:00Z'),
    };
    expect(checkClipAccepted(base)).toEqual({ ok: true });
    expect(checkClipAccepted({ ...base, notesEnabled: false })).toMatchObject({ ok: false, status: 409, code: 'NOTES_OFF' });
    expect(checkClipAccepted({ ...base, provider: 'EXTERNAL' })).toMatchObject({ ok: false, status: 409 });
    expect(checkClipAccepted({ ...base, meetingStatus: 'CANCELLED' })).toMatchObject({ ok: false });
    expect(checkClipAccepted({ ...base, size: MAX_CLIP_BYTES + 1 })).toMatchObject({ ok: false, status: 413 });
    expect(checkClipAccepted({ ...base, size: 0 })).toMatchObject({ ok: false, status: 400 });
    expect(checkClipAccepted({ ...base, mediaType: 'video/mp4' })).toMatchObject({ ok: false, status: 415 });
    expect(checkClipAccepted({ ...base, segmentCount: 4000 })).toMatchObject({ ok: false, code: 'NOTES_FULL' });
    // Last clip right after "End for everyone" is still accepted; much later it is not
    expect(checkClipAccepted({ ...base, endedAt: '2026-10-04T10:09:30Z' })).toEqual({ ok: true });
    expect(checkClipAccepted({ ...base, endedAt: '2026-10-04T10:05:00Z' })).toMatchObject({ ok: false, code: 'NOTES_OFF' });
  });

  it('exposes the meeting agent tools to staff roles only', () => {
    for (const tool of ['list_meetings', 'get_meeting_notes', 'summarize_meeting', 'create_tasks_from_meeting_action_items']) {
      for (const role of ['ADMIN', 'SALES', 'SUPPORT_MANAGER', 'TECHNICIAN']) {
        expect(canRoleUseTool(tool, role)).toBe(true);
      }
      expect(canRoleUseTool(tool, 'CUSTOMER')).toBe(false);
    }
  });
});
