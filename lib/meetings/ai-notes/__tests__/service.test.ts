/**
 * @jest-environment node
 */
const db = {
  meetingNotes: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
    updateMany: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
  meetingTranscriptSegment: {
    count: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    upsert: jest.fn(),
  },
  task: { create: jest.fn() },
};
jest.mock('@/lib/prisma', () => ({
  get prisma() {
    return db;
  },
}));

const gemini = {
  transcribeClip: jest.fn(),
  summarizeMeetingTranscript: jest.fn(),
  isNotesAiConfigured: jest.fn(),
};
jest.mock('../gemini', () => {
  class AiNotConfiguredError extends Error {}
  return {
    AiNotConfiguredError,
    transcribeClip: (...a: unknown[]) => gemini.transcribeClip(...a),
    summarizeMeetingTranscript: (...a: unknown[]) => gemini.summarizeMeetingTranscript(...a),
    isNotesAiConfigured: (...a: unknown[]) => gemini.isNotesAiConfigured(...a),
  };
});

const meetings = { getMeetingForViewer: jest.fn(), loadMeeting: jest.fn() };
jest.mock('../../service', () => ({
  getMeetingForViewer: (...a: unknown[]) => meetings.getMeetingForViewer(...a),
  loadMeeting: (...a: unknown[]) => meetings.loadMeeting(...a),
}));

const notify = { deliverMeetingNotification: jest.fn(), publishMeetingChanged: jest.fn() };
jest.mock('../../notifications', () => ({
  DEFAULT_MEETING_TIME_ZONE: 'UTC',
  formatMeetingTime: () => 'Sat 4 Oct, 10:00 – 10:30 UTC',
  deliverMeetingNotification: (...a: unknown[]) => notify.deliverMeetingNotification(...a),
  publishMeetingChanged: (...a: unknown[]) => notify.publishMeetingChanged(...a),
}));

const rateLimit = jest.fn();
jest.mock('@/lib/rate-limit-store', () => ({ consumeRateLimit: (...a: unknown[]) => rateLimit(...a) }));
const canWrite = jest.fn();
jest.mock('@/lib/projects/task-access', () => ({ canWriteProjectDelivery: (...a: unknown[]) => canWrite(...a) }));
const createProjectTask = jest.fn();
jest.mock('@/lib/projects/create-task', () => ({ createProjectTask: (...a: unknown[]) => createProjectTask(...a) }));
jest.mock('@/lib/projects/mentions', () => ({ isCompanyStaff: async () => true }));
jest.mock('@/lib/logger', () => ({ logError: jest.fn() }));

import type { Session } from 'next-auth';
import {
  appendClip,
  convertActionItem,
  generateMeetingNotes,
  isNotesSchemaMissing,
  needsAutoGeneration,
  regenerateNotes,
} from '../service';

const person = (id: string, name: string) => ({ id, name, email: `${id}@acme.test`, image: null });

function meetingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'm1',
    companyId: 'c1',
    organizerId: 'org',
    provider: 'OPSLANE',
    startedAt: new Date('2026-10-04T10:00:00Z'),
    endedAt: null,
    event: {
      title: 'Launch sync',
      description: null,
      status: 'SCHEDULED',
      startTime: new Date(Date.now() - 10 * 60_000),
      endTime: new Date(Date.now() + 20 * 60_000),
    },
    organizer: person('org', 'Olivia Organizer'),
    attendees: [
      { userId: 'org', inRoom: true, user: person('org', 'Olivia Organizer') },
      { userId: 'asha', inRoom: true, user: person('asha', 'Asha Kumari') },
    ],
    ...overrides,
  };
}

const viewer = (userId: string, role = 'SALES') => ({ userId, role, isWorkspaceStaff: true, name: 'Client-side name' });
const clip = { audio: new Uint8Array(1000), mediaType: 'audio/wav', startedAt: String(Date.now() - 25_000), durationMs: 25_000 };

beforeEach(() => {
  jest.clearAllMocks();
  rateLimit.mockResolvedValue(true);
  db.meetingTranscriptSegment.count.mockResolvedValue(0);
  db.meetingNotes.findUnique.mockResolvedValue({ meetingId: 'm1', aiNotesEnabled: true, aiNotesStartedById: 'org', updatedAt: new Date() });
  db.meetingTranscriptSegment.upsert.mockImplementation(async ({ create }: { create: Record<string, unknown> }) => ({ id: 's1', ...create }));
});

describe('appendClip', () => {
  it('stores the line under the signed-in speaker (name from the attendee list, not the client)', async () => {
    meetings.getMeetingForViewer.mockResolvedValue(meetingRow());
    gemini.transcribeClip.mockResolvedValue('Let us ship on Friday');
    const result = await appendClip('m1', 'c1', viewer('asha'), clip);
    expect(result.text).toBe('Let us ship on Friday');
    const call = db.meetingTranscriptSegment.upsert.mock.calls[0][0];
    expect(call.create).toMatchObject({ meetingId: 'm1', companyId: 'c1', speakerId: 'asha', speakerName: 'Asha Kumari' });
    expect(call.where.meetingId_speakerId_startedAt.speakerId).toBe('asha');
    // The person who turned notes on pays for the AI call
    expect(gemini.transcribeClip.mock.calls[0][0].payerUserId).toBe('org');
  });

  it('stores nothing for silence', async () => {
    meetings.getMeetingForViewer.mockResolvedValue(meetingRow());
    gemini.transcribeClip.mockResolvedValue('');
    await expect(appendClip('m1', 'c1', viewer('asha'), clip)).resolves.toEqual({ text: '', segment: null });
    expect(db.meetingTranscriptSegment.upsert).not.toHaveBeenCalled();
  });

  it('rejects people who are not in the meeting', async () => {
    meetings.getMeetingForViewer.mockResolvedValue(meetingRow());
    await expect(appendClip('m1', 'c1', viewer('outsider'), clip)).rejects.toMatchObject({ statusCode: 404 });
    expect(gemini.transcribeClip).not.toHaveBeenCalled();
  });

  it('rejects clips while notes are off', async () => {
    meetings.getMeetingForViewer.mockResolvedValue(meetingRow());
    db.meetingNotes.findUnique.mockResolvedValue({ meetingId: 'm1', aiNotesEnabled: false });
    await expect(appendClip('m1', 'c1', viewer('asha'), clip)).rejects.toMatchObject({ statusCode: 409, code: 'NOTES_OFF' });
    expect(gemini.transcribeClip).not.toHaveBeenCalled();
  });

  it('rate-limits per person per meeting', async () => {
    meetings.getMeetingForViewer.mockResolvedValue(meetingRow());
    rateLimit.mockResolvedValue(false);
    await expect(appendClip('m1', 'c1', viewer('asha'), clip)).rejects.toMatchObject({ statusCode: 429 });
    expect(rateLimit.mock.calls[0][0]).toBe('meeting-notes:m1:asha');
  });

  it('turns an overloaded model into a 503 the client can retry', async () => {
    meetings.getMeetingForViewer.mockResolvedValue(meetingRow());
    gemini.transcribeClip.mockRejectedValue(new Error('503 UNAVAILABLE: model overloaded'));
    await expect(appendClip('m1', 'c1', viewer('asha'), clip)).rejects.toMatchObject({ statusCode: 503, code: 'AI_BUSY' });
  });
});

describe('generateMeetingNotes', () => {
  const segments = [
    { speakerId: 'asha', speakerName: 'Asha Kumari', startedAt: new Date('2026-10-04T10:01:00Z'), text: 'I will send the brief by Friday.' },
    { speakerId: 'org', speakerName: 'Olivia Organizer', startedAt: new Date('2026-10-04T10:00:30Z'), text: 'Welcome.' },
  ];

  beforeEach(() => {
    db.meetingTranscriptSegment.findMany.mockResolvedValue(segments);
    db.meetingNotes.upsert.mockResolvedValue({});
    db.meetingNotes.updateMany.mockResolvedValue({ count: 1 });
    db.meetingNotes.update.mockImplementation(async ({ data }: { data: unknown }) => data);
    db.meetingNotes.findUnique.mockResolvedValue({ meetingId: 'm1', aiNotesStartedById: 'org', notesGeneratedAt: null, actionItems: [] });
  });

  it('writes summary + items with owners matched to attendees and notifies once', async () => {
    gemini.summarizeMeetingTranscript.mockResolvedValue({
      summary: 'Launch planning.',
      keyPoints: ['Ship Friday'],
      actionItems: [
        { text: 'Send the brief', owner: 'Asha', dueDate: '2026-10-10' },
        { text: 'Check budget', owner: 'Someone Else', dueDate: null },
      ],
    });
    const result = await generateMeetingNotes(meetingRow());
    expect(result.ok).toBe(true);
    const input = gemini.summarizeMeetingTranscript.mock.calls[0][0];
    // Ordered by clip start, speaker-labelled
    expect(input.transcript.split('\n')[0]).toContain('Olivia Organizer: Welcome.');
    const data = db.meetingNotes.update.mock.calls[0][0].data;
    expect(data.actionItems[0]).toMatchObject({ text: 'Send the brief', ownerUserId: 'asha', ownerName: 'Asha Kumari', dueDate: '2026-10-10' });
    expect(data.actionItems[1]).toMatchObject({ ownerUserId: null, ownerName: 'Someone Else' });
    expect(data.generatingAt).toBeNull();
    expect(notify.deliverMeetingNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'MEETING_UPDATED', userIds: ['org', 'asha'] })
    );
  });

  it('does not notify again on a regenerate', async () => {
    db.meetingNotes.findUnique.mockResolvedValue({ meetingId: 'm1', notesGeneratedAt: new Date(), actionItems: [] });
    gemini.summarizeMeetingTranscript.mockResolvedValue({ summary: 'x', keyPoints: [], actionItems: [] });
    await generateMeetingNotes(meetingRow());
    expect(notify.deliverMeetingNotification).not.toHaveBeenCalled();
  });

  it('stores a friendly error when the model is busy', async () => {
    gemini.summarizeMeetingTranscript.mockRejectedValue(new Error('429 RESOURCE_EXHAUSTED'));
    const result = await generateMeetingNotes(meetingRow());
    expect(result).toMatchObject({ ok: false, reason: 'ai-busy' });
    expect(db.meetingNotes.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ generatingAt: null, generationError: expect.stringMatching(/busy/) }) })
    );
  });

  it('runs once at a time', async () => {
    db.meetingNotes.updateMany.mockResolvedValue({ count: 0 });
    await expect(generateMeetingNotes(meetingRow())).resolves.toMatchObject({ ok: false, reason: 'busy-elsewhere' });
    expect(gemini.summarizeMeetingTranscript).not.toHaveBeenCalled();
  });

  it('needs a transcript', async () => {
    db.meetingTranscriptSegment.findMany.mockResolvedValue([]);
    await expect(generateMeetingNotes(meetingRow())).resolves.toMatchObject({ ok: false, reason: 'empty' });
  });

  it('only lets the organizer or an admin regenerate', async () => {
    meetings.getMeetingForViewer.mockResolvedValue(meetingRow());
    await expect(regenerateNotes('m1', 'c1', viewer('asha'))).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('needsAutoGeneration', () => {
  const last = new Date('2026-10-04T11:00:00Z');
  it('runs for finished meetings with uncovered transcript only', () => {
    expect(needsAutoGeneration({ over: true, segmentCount: 3, lastSegmentAt: last, notes: null })).toBe(true);
    expect(needsAutoGeneration({ over: false, segmentCount: 3, lastSegmentAt: last, notes: null })).toBe(false);
    expect(needsAutoGeneration({ over: true, segmentCount: 0, lastSegmentAt: null, notes: null })).toBe(false);
    expect(
      needsAutoGeneration({ over: true, segmentCount: 3, lastSegmentAt: last, notes: { notesGeneratedAt: new Date('2026-10-04T11:01:00Z') } })
    ).toBe(false);
    // A failure on this same transcript waits for Regenerate instead of retrying on every view
    expect(
      needsAutoGeneration({
        over: true,
        segmentCount: 3,
        lastSegmentAt: last,
        notes: { generationError: 'busy', updatedAt: new Date('2026-10-04T11:02:00Z') },
      })
    ).toBe(false);
  });
});

describe('convertActionItem', () => {
  const session = (id: string, role = 'SALES') => ({ user: { id, role, name: 'X' } }) as unknown as Session;

  beforeEach(() => {
    meetings.getMeetingForViewer.mockResolvedValue(meetingRow());
    db.meetingNotes.findUnique.mockResolvedValue({
      meetingId: 'm1',
      updatedAt: new Date(),
      actionItems: [
        { id: 'i1', text: 'Send the brief', ownerUserId: 'asha', dueDate: '2026-10-10' },
        { id: 'i2', text: 'Already done', followUpId: 'tX' },
      ],
    });
    db.meetingNotes.updateMany.mockResolvedValue({ count: 1 });
    db.task.create.mockResolvedValue({ id: 't1', title: 'Send the brief' });
  });

  it('creates a follow-up assigned to the owner and links it', async () => {
    const result = await convertActionItem({ meetingId: 'm1', companyId: 'c1', session: session('org'), itemId: 'i1', kind: 'follow-up' });
    expect(db.task.create.mock.calls[0][0].data).toMatchObject({
      userId: 'org',
      assignedToId: 'asha',
      title: 'Send the brief',
      type: 'FOLLOW_UP',
    });
    expect(result.item).toMatchObject({ id: 'i1', followUpId: 't1' });
    const saved = db.meetingNotes.updateMany.mock.calls[0][0].data.actionItems;
    expect(saved.find((i: { id: string }) => i.id === 'i1').followUpId).toBe('t1');
  });

  it('refuses to convert twice', async () => {
    await expect(
      convertActionItem({ meetingId: 'm1', companyId: 'c1', session: session('org'), itemId: 'i2', kind: 'follow-up' })
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('needs write access to the project for project tasks', async () => {
    canWrite.mockResolvedValue(false);
    await expect(
      convertActionItem({ meetingId: 'm1', companyId: 'c1', session: session('asha'), itemId: 'i1', kind: 'project-task', projectId: 'p1' })
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(createProjectTask).not.toHaveBeenCalled();
  });

  it('creates the project task with the owner as assignee', async () => {
    canWrite.mockResolvedValue(true);
    createProjectTask.mockResolvedValue({ ok: true, task: { id: 'pt1', title: 'Send the brief' }, effects: async () => {} });
    const result = await convertActionItem({
      meetingId: 'm1',
      companyId: 'c1',
      session: session('org'),
      itemId: 'i1',
      kind: 'project-task',
      projectId: 'p1',
    });
    expect(createProjectTask.mock.calls[0][0]).toMatchObject({ companyId: 'c1', projectId: 'p1', body: { assigneeId: 'asha', dueDate: '2026-10-10' } });
    expect(result.item).toMatchObject({ taskId: 'pt1', projectId: 'p1' });
  });
});

describe('isNotesSchemaMissing', () => {
  it('recognises a missing notes table', () => {
    expect(isNotesSchemaMissing({ code: 'P2021', message: 'The table `public.MeetingNotes` does not exist' })).toBe(true);
    expect(isNotesSchemaMissing({ message: 'relation "MeetingTranscriptSegment" does not exist' })).toBe(true);
    expect(isNotesSchemaMissing({ code: 'P2002', message: 'Unique constraint' })).toBe(false);
    expect(isNotesSchemaMissing(null)).toBe(false);
  });
});
