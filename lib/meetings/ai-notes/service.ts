/**
 * AI meeting notes — data access and workflows shared by the API routes and the OPS agent:
 * the capture switch, per-speaker clip transcription, summary generation (on end + on demand),
 * action items → follow-ups / project tasks. Everything is scoped by companyId and goes
 * through the same viewer rules as the meetings API (getMeetingForViewer → 404 for outsiders).
 */
import { randomBytes } from 'crypto';
import type { Session } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { ApiException } from '@/lib/api-error-handler';
import { logError } from '@/lib/logger';
import { consumeRateLimit } from '@/lib/rate-limit-store';
import { canWriteProjectDelivery } from '@/lib/projects/task-access';
import { createProjectTask } from '@/lib/projects/create-task';
import { isCompanyStaff } from '@/lib/projects/mentions';
import { getMeetingForViewer, loadMeeting } from '../service';
import { JOIN_GRACE_MS, type MeetingViewer } from '../rules';
import { DEFAULT_MEETING_TIME_ZONE, deliverMeetingNotification, formatMeetingTime, publishMeetingChanged } from '../notifications';
import type { MeetingPerson } from '../types';
import {
  buildActionItems,
  canContributeAudio,
  canControlNotes,
  canEditActionItems,
  canViewNotes,
  checkClipAccepted,
  clampClipStart,
  CLIP_RATE_PER_MINUTE,
  formatTranscript,
  GENERATION_STALE_MS,
  isAiBusyError,
  MAX_CLIP_MS,
  mergeActionItems,
  readActionItems,
  readKeyPoints,
  sortSegments,
  type ActionItem,
} from './rules';
import { AiNotConfiguredError, isNotesAiConfigured, summarizeMeetingTranscript, transcribeClip } from './gemini';
import type { ActionItemDTO, MeetingNotesDTO, TranscriptLineDTO } from './types';

type MeetingRow = any;
type NotesRow = any;

// ── Errors ──────────────────────────────────────────────────────────────────

/** True when the AI-notes migration has not been applied (missing table/column). */
export function isNotesSchemaMissing(error: unknown) {
  const e = error as { code?: string; message?: string } | null;
  if (!e) return false;
  const msg = typeof e.message === 'string' ? e.message : '';
  if ((e.code === 'P2021' || e.code === 'P2022') && (!msg || /MeetingNotes|MeetingTranscriptSegment/.test(msg))) return true;
  return /MeetingNotes|MeetingTranscriptSegment/.test(msg) && /does not exist|relation/i.test(msg);
}

export const NOTES_NOT_READY_MESSAGE =
  'AI meeting notes need a one-time database update (migration 20261004090000_meeting_ai_notes). Ask your workspace owner to apply it.';

function accessShape(row: MeetingRow) {
  return {
    organizerId: row.organizerId as string,
    attendeeIds: (row.attendees as any[]).map((a) => a.userId as string),
  };
}

function iso(d: Date | string | null | undefined) {
  return d ? new Date(d).toISOString() : null;
}

function people(row: MeetingRow): MeetingPerson[] {
  const list: MeetingPerson[] = (row.attendees as any[]).map((a) => a.user).filter(Boolean);
  if (row.organizer && !list.some((p) => p.id === row.organizer.id)) list.unshift(row.organizer);
  return list;
}

/** Ended explicitly, completed/cancelled, or past its end with nobody left in the room. */
export function isMeetingOver(row: MeetingRow, now: Date = new Date()) {
  const status = row.event.status;
  if (status === 'CANCELLED') return true;
  const start = new Date(row.event.startTime).getTime();
  const end = new Date(row.event.endTime).getTime();
  if (row.endedAt && new Date(row.endedAt).getTime() >= start) return true;
  const t = now.getTime();
  const someoneInRoom = t < end + JOIN_GRACE_MS * 3 && (row.attendees as any[]).some((a) => a.inRoom);
  // Completed, but the organizer reopened the room (endedAt cleared) and people are in it
  if (status === 'COMPLETED') return !someoneInRoom;
  if (t <= end + 10 * 60_000) return false;
  return !someoneInRoom;
}

async function loadNotes(meetingId: string): Promise<NotesRow | null> {
  return prisma.meetingNotes.findUnique({ where: { meetingId } });
}

async function ensureNotes(row: MeetingRow): Promise<NotesRow> {
  return prisma.meetingNotes.upsert({
    where: { meetingId: row.id },
    create: { meetingId: row.id, companyId: row.companyId },
    update: {},
  });
}

function isGenerating(notes: NotesRow | null, now = Date.now()) {
  return !!notes?.generatingAt && now - new Date(notes.generatingAt).getTime() < GENERATION_STALE_MS;
}

async function segmentStats(meetingId: string) {
  const [count, last] = await Promise.all([
    prisma.meetingTranscriptSegment.count({ where: { meetingId } }),
    prisma.meetingTranscriptSegment.findFirst({
      where: { meetingId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
  ]);
  return { count: count as number, lastCreatedAt: (last?.createdAt as Date | undefined) ?? null };
}

/**
 * Should viewing the notes kick off a summary? The meeting is over, there is transcript the
 * current summary doesn't cover, nothing is running, and the last attempt didn't already
 * fail on this same transcript (then people press Regenerate instead of looping).
 */
export function needsAutoGeneration(args: {
  over: boolean;
  segmentCount: number;
  lastSegmentAt: Date | null;
  notes: { notesGeneratedAt?: Date | null; generatingAt?: Date | null; generationError?: string | null; updatedAt?: Date | null } | null;
  now?: Date;
}) {
  if (!args.over || args.segmentCount === 0 || !args.lastSegmentAt) return false;
  const n = args.notes;
  if (isGenerating(n, (args.now ?? new Date()).getTime())) return false;
  const last = args.lastSegmentAt.getTime();
  if (n?.notesGeneratedAt && new Date(n.notesGeneratedAt).getTime() >= last) return false;
  if (n?.generationError && n.updatedAt && new Date(n.updatedAt).getTime() >= last) return false;
  return true;
}

// ── Reads ───────────────────────────────────────────────────────────────────

function toItemDTO(item: ActionItem, byId: Map<string, MeetingPerson>): ActionItemDTO {
  return { ...item, owner: item.ownerUserId ? byId.get(item.ownerUserId) ?? null : null };
}

export async function buildNotesDTO(
  row: MeetingRow,
  viewer: MeetingViewer,
  opts: { transcript?: boolean; checkAi?: boolean } = {}
): Promise<{ dto: MeetingNotesDTO; autoGenerate: boolean }> {
  const [notes, stats] = await Promise.all([loadNotes(row.id), segmentStats(row.id)]);
  const shape = accessShape(row);
  const byId = new Map(people(row).map((p) => [p.id, p]));
  let transcript: TranscriptLineDTO[] | null = null;
  if (opts.transcript) {
    const segments = await prisma.meetingTranscriptSegment.findMany({
      where: { meetingId: row.id },
      orderBy: [{ startedAt: 'asc' }, { speakerName: 'asc' }],
      select: { id: true, speakerId: true, speakerName: true, startedAt: true, text: true },
      take: 5000,
    });
    transcript = (segments as any[]).map((s) => ({
      id: s.id,
      speakerId: s.speakerId,
      speakerName: s.speakerName,
      startedAt: iso(s.startedAt)!,
      text: s.text,
    }));
  }
  const over = isMeetingOver(row);
  const startedById = notes?.aiNotesStartedById ?? null;
  const starter = startedById ? byId.get(startedById) : null;
  const canControl = canControlNotes(viewer, shape);
  const generating = isGenerating(notes);
  const dto: MeetingNotesDTO = {
    meetingId: row.id,
    enabled: !!notes?.aiNotesEnabled && !over,
    startedBy: startedById ? { id: startedById, name: starter ? starter.name || starter.email : null } : null,
    startedAt: iso(notes?.aiNotesStartedAt),
    summary: notes?.summary ?? null,
    keyPoints: readKeyPoints(notes?.keyPoints),
    actionItems: readActionItems(notes?.actionItems).map((i) => toItemDTO(i, byId)),
    generatedAt: iso(notes?.notesGeneratedAt),
    generating,
    error: generating ? null : notes?.generationError ?? null,
    transcript,
    segmentCount: stats.count,
    lastSegmentAt: iso(stats.lastCreatedAt),
    canControl,
    canEdit: canEditActionItems(viewer, shape),
    aiConfigured: opts.checkAi && canControl ? await isNotesAiConfigured(startedById ?? row.organizerId) : null,
    meetingOver: over,
  };
  const autoGenerate = needsAutoGeneration({ over, segmentCount: stats.count, lastSegmentAt: stats.lastCreatedAt, notes });
  if (autoGenerate) dto.generating = true;
  return { dto, autoGenerate };
}

export async function getNotesForViewer(
  meetingId: string,
  companyId: string,
  viewer: MeetingViewer,
  opts: { transcript?: boolean; checkAi?: boolean } = {}
) {
  const row = await getMeetingForViewer(meetingId, companyId, viewer);
  if (!canViewNotes(viewer, accessShape(row))) throw new ApiException('Meeting not found', 404, 'NOT_FOUND');
  return buildNotesDTO(row, viewer, opts);
}

// ── Capture switch ──────────────────────────────────────────────────────────

export async function setNotesEnabled(
  meetingId: string,
  companyId: string,
  viewer: MeetingViewer & { name?: string | null },
  enabled: boolean
) {
  const row = await getMeetingForViewer(meetingId, companyId, viewer);
  if (!canControlNotes(viewer, accessShape(row))) {
    throw new ApiException('Only the organizer can turn AI notes on or off', 403, 'FORBIDDEN');
  }
  if (enabled) {
    if (row.provider !== 'OPSLANE') throw new ApiException('AI notes work in Opslane video rooms only.', 409, 'NOT_OPSLANE');
    if (row.event.status === 'CANCELLED') throw new ApiException('This meeting was cancelled.', 409, 'CANCELLED');
    if (!(await isNotesAiConfigured(viewer.userId))) {
      throw new ApiException(new AiNotConfiguredError().message, 400, 'AI_NOT_CONFIGURED');
    }
  }
  await prisma.meetingNotes.upsert({
    where: { meetingId: row.id },
    create: {
      meetingId: row.id,
      companyId,
      aiNotesEnabled: enabled,
      ...(enabled ? { aiNotesStartedById: viewer.userId, aiNotesStartedAt: new Date() } : {}),
    },
    update: {
      aiNotesEnabled: enabled,
      ...(enabled ? { aiNotesStartedById: viewer.userId, aiNotesStartedAt: new Date() } : {}),
    },
  });
  await publishMeetingChanged(row, accessShape(row).attendeeIds);
  return (await buildNotesDTO(row, viewer)).dto;
}

// ── Clip upload ─────────────────────────────────────────────────────────────

/**
 * One clip of the caller's OWN microphone → one transcript line labelled with their name.
 * Silence comes back as "" and stores nothing.
 */
export async function appendClip(
  meetingId: string,
  companyId: string,
  viewer: MeetingViewer & { name?: string | null },
  clip: { audio: Uint8Array; mediaType: string; startedAt: unknown; durationMs: unknown }
) {
  const row = await getMeetingForViewer(meetingId, companyId, viewer);
  if (!canContributeAudio(viewer, accessShape(row))) throw new ApiException('Meeting not found', 404, 'NOT_FOUND');
  const [notes, segmentCount] = await Promise.all([
    loadNotes(row.id),
    prisma.meetingTranscriptSegment.count({ where: { meetingId: row.id } }),
  ]);
  const check = checkClipAccepted({
    notesEnabled: !!notes?.aiNotesEnabled,
    meetingStatus: row.event.status,
    provider: row.provider,
    endedAt: row.endedAt,
    startTime: row.event.startTime,
    segmentCount,
    size: clip.audio.byteLength,
    mediaType: clip.mediaType,
  });
  if (!check.ok) throw new ApiException(check.error, check.status, check.code);

  const allowed = await consumeRateLimit(`meeting-notes:${row.id}:${viewer.userId}`, {
    windowMs: 60_000,
    maxRequests: CLIP_RATE_PER_MINUTE,
  });
  if (!allowed) throw new ApiException('Too many clips — slow down.', 429, 'RATE_LIMITED');

  const me = (row.attendees as any[]).find((a) => a.userId === viewer.userId)?.user;
  const speakerName = (me?.name || viewer.name || me?.email || 'Someone').slice(0, 120);
  const durationMs = Math.max(0, Math.min(MAX_CLIP_MS, Math.round(Number(clip.durationMs) || 0)));
  const startedAt = clampClipStart(clip.startedAt, durationMs, row.event.startTime);

  let text: string;
  try {
    text = await transcribeClip({
      payerUserId: notes?.aiNotesStartedById ?? row.organizerId,
      audio: clip.audio,
      mediaType: clip.mediaType,
      speakerName,
      meetingTitle: row.event.title,
    });
  } catch (error) {
    if (error instanceof AiNotConfiguredError) throw new ApiException(error.message, 400, 'AI_NOT_CONFIGURED');
    logError(error, { context: 'meeting notes: clip transcription failed', meetingId: row.id });
    if (isAiBusyError(error)) throw new ApiException('AI is busy right now — this part was skipped.', 503, 'AI_BUSY');
    throw new ApiException('Could not transcribe this part of the call.', 502, 'TRANSCRIBE_FAILED');
  }
  if (!text) return { text: '', segment: null };

  // Retries of the same clip (same speaker + start) overwrite instead of duplicating
  const segment = await prisma.meetingTranscriptSegment.upsert({
    where: { meetingId_speakerId_startedAt: { meetingId: row.id, speakerId: viewer.userId, startedAt } },
    create: { meetingId: row.id, companyId, speakerId: viewer.userId, speakerName, startedAt, durationMs, text },
    update: { text, durationMs, speakerName },
  });
  const line: TranscriptLineDTO = {
    id: segment.id,
    speakerId: segment.speakerId,
    speakerName: segment.speakerName,
    startedAt: iso(segment.startedAt)!,
    text: segment.text,
  };
  return { text, segment: line };
}

// ── Summary ─────────────────────────────────────────────────────────────────

const newItemId = () => `ai_${randomBytes(6).toString('hex')}`;

/** Claim the summary slot (one run per meeting); false when another run is in progress. */
async function claimGeneration(meetingId: string, companyId: string) {
  await prisma.meetingNotes.upsert({ where: { meetingId }, create: { meetingId, companyId }, update: {} });
  const now = new Date();
  const claim = await prisma.meetingNotes.updateMany({
    where: {
      meetingId,
      OR: [{ generatingAt: null }, { generatingAt: { lt: new Date(now.getTime() - GENERATION_STALE_MS) } }],
    },
    data: { generatingAt: now },
  });
  return claim.count > 0;
}

export type GenerateResult =
  | { ok: true; notes: NotesRow; itemCount: number }
  | { ok: false; reason: 'empty' | 'busy-elsewhere' | 'ai-busy' | 'not-configured' | 'failed'; error: string };

/**
 * Transcript → summary / key points / action items. Keeps ticked and converted items
 * across regenerations. Notifies attendees the first time notes are ready.
 * Never throws for AI problems — the outcome is stored on the notes row and returned.
 */
export async function generateMeetingNotes(row: MeetingRow, opts: { notify?: boolean; actorId?: string } = {}): Promise<GenerateResult> {
  const segments = await prisma.meetingTranscriptSegment.findMany({
    where: { meetingId: row.id },
    orderBy: [{ startedAt: 'asc' }, { speakerName: 'asc' }],
    select: { speakerId: true, speakerName: true, startedAt: true, text: true },
    take: 5000,
  });
  if (segments.length === 0) {
    return { ok: false, reason: 'empty', error: 'There is no transcript yet. Turn on AI notes during the call.' };
  }
  if (!(await claimGeneration(row.id, row.companyId))) {
    return { ok: false, reason: 'busy-elsewhere', error: 'Notes are already being written — check back in a moment.' };
  }

  const before = await loadNotes(row.id);
  const transcript = formatTranscript(sortSegments(segments as any[]), row.startedAt ?? row.event.startTime);
  const attendees = people(row);
  try {
    const parsed = await summarizeMeetingTranscript({
      payerUserId: before?.aiNotesStartedById ?? row.organizerId,
      transcript,
      meetingTitle: row.event.title,
      meetingDate: new Date(row.event.startTime),
      timeZone: DEFAULT_MEETING_TIME_ZONE,
      agenda: row.event.description,
      attendeeNames: attendees.map((p) => p.name || p.email),
    });
    const items = mergeActionItems(
      readActionItems(before?.actionItems),
      buildActionItems(parsed.actionItems, attendees, newItemId)
    );
    const firstTime = !before?.notesGeneratedAt;
    const notes = await prisma.meetingNotes.update({
      where: { meetingId: row.id },
      data: {
        transcript,
        summary: parsed.summary || null,
        keyPoints: parsed.keyPoints,
        actionItems: items,
        notesGeneratedAt: new Date(),
        generatingAt: null,
        generationError: null,
        ...(isMeetingOver(row) ? { aiNotesEnabled: false } : {}),
      },
    });
    const ids = accessShape(row).attendeeIds;
    if (opts.notify !== false && firstTime) {
      const title = row.event.title as string;
      const open = items.filter((i) => !i.done).length;
      await deliverMeetingNotification({
        type: 'MEETING_UPDATED',
        meeting: { id: row.id, companyId: row.companyId, title },
        userIds: ids,
        title: `AI notes ready: ${title}`,
        body: `${formatMeetingTime(row.event.startTime, row.event.endTime)} · Summary${open ? ` and ${open} action item${open === 1 ? '' : 's'}` : ''}.`,
      });
    }
    await publishMeetingChanged(row, ids, opts.actorId);
    return { ok: true, notes, itemCount: items.length };
  } catch (error) {
    const notConfigured = error instanceof AiNotConfiguredError;
    const busy = !notConfigured && isAiBusyError(error);
    if (!notConfigured) logError(error, { context: 'meeting notes: summary failed', meetingId: row.id });
    const message = notConfigured
      ? error.message
      : busy
        ? 'AI is busy right now — try Regenerate in a minute.'
        : 'The assistant could not write notes for this meeting. Try Regenerate.';
    await prisma.meetingNotes
      .update({ where: { meetingId: row.id }, data: { generatingAt: null, generationError: message } })
      .catch(() => {});
    await publishMeetingChanged(row, accessShape(row).attendeeIds, opts.actorId);
    return { ok: false, reason: notConfigured ? 'not-configured' : busy ? 'ai-busy' : 'failed', error: message };
  }
}

/** Regenerate on demand (organizer / admin). */
export async function regenerateNotes(meetingId: string, companyId: string, viewer: MeetingViewer) {
  const row = await getMeetingForViewer(meetingId, companyId, viewer);
  if (!canControlNotes(viewer, accessShape(row))) {
    throw new ApiException('Only the organizer can regenerate the notes', 403, 'FORBIDDEN');
  }
  const result = await generateMeetingNotes(row, { actorId: viewer.userId });
  if (!result.ok) {
    const status = result.reason === 'empty' ? 400 : result.reason === 'busy-elsewhere' ? 409 : result.reason === 'not-configured' ? 400 : 503;
    throw new ApiException(result.error, status, result.reason === 'not-configured' ? 'AI_NOT_CONFIGURED' : result.reason.toUpperCase().replace('-', '_'));
  }
  return (await buildNotesDTO(row, viewer, { transcript: true })).dto;
}

/**
 * The meeting ended ("End for everyone", LiveKit room_finished): stop capture and write the
 * notes once the last in-flight clips have landed. System action — no viewer check.
 * Swallows every error (runs after the response).
 */
export async function finalizeNotesAfterEnd(meetingId: string, companyId: string, opts: { delayMs?: number } = {}) {
  try {
    const notes = await loadNotes(meetingId);
    if (!notes) return;
    // Capture stops; an older failed attempt must not block the end-of-meeting summary
    await prisma.meetingNotes.update({ where: { meetingId }, data: { aiNotesEnabled: false, generationError: null } });
    const delay = opts.delayMs ?? 6_000;
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));
    const row = await loadMeeting(meetingId, companyId);
    if (!row) return;
    const stats = await segmentStats(meetingId);
    const fresh = await loadNotes(meetingId);
    if (!needsAutoGeneration({ over: true, segmentCount: stats.count, lastSegmentAt: stats.lastCreatedAt, notes: fresh })) return;
    await generateMeetingNotes(row);
  } catch (error) {
    if (!isNotesSchemaMissing(error)) logError(error, { context: 'meeting notes: finalize after end', meetingId });
  }
}

/** Background run started by a GET that found stale notes (see needsAutoGeneration). */
export async function autoGenerateNotes(meetingId: string, companyId: string) {
  try {
    const row = await loadMeeting(meetingId, companyId);
    if (row) await generateMeetingNotes(row);
  } catch (error) {
    if (!isNotesSchemaMissing(error)) logError(error, { context: 'meeting notes: auto generate', meetingId });
  }
}

// ── Action items ────────────────────────────────────────────────────────────

/** Read-modify-write of the items JSON with an updatedAt guard (one retry on a race). */
async function mutateItems(
  meetingId: string,
  fn: (items: ActionItem[]) => ActionItem[]
): Promise<ActionItem[]> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const notes = await loadNotes(meetingId);
    if (!notes) throw new ApiException('No notes for this meeting yet', 404, 'NOT_FOUND');
    const next = fn(readActionItems(notes.actionItems));
    const res = await prisma.meetingNotes.updateMany({
      where: { meetingId, updatedAt: notes.updatedAt },
      data: { actionItems: next },
    });
    if (res.count > 0) return next;
  }
  throw new ApiException('The notes changed at the same time — try again.', 409, 'CONFLICT');
}

function findItem(items: ActionItem[], itemId: string) {
  const item = items.find((i) => i.id === itemId);
  if (!item) throw new ApiException('Action item not found', 404, 'NOT_FOUND');
  return item;
}

export async function updateActionItem(
  meetingId: string,
  companyId: string,
  viewer: MeetingViewer,
  itemId: string,
  patch: { done?: unknown }
) {
  const row = await getMeetingForViewer(meetingId, companyId, viewer);
  if (!canEditActionItems(viewer, accessShape(row))) throw new ApiException('Meeting not found', 404, 'NOT_FOUND');
  if (typeof patch.done !== 'boolean') throw new ApiException('Nothing to change', 400, 'BAD_REQUEST');
  const done = patch.done;
  const items = await mutateItems(row.id, (list) => {
    findItem(list, itemId);
    return list.map((i) => (i.id === itemId ? { ...i, done } : i));
  });
  void publishMeetingChanged(row, accessShape(row).attendeeIds, viewer.userId);
  const byId = new Map(people(row).map((p) => [p.id, p]));
  return toItemDTO(findItem(items, itemId), byId);
}

export type ConvertKind = 'follow-up' | 'project-task';

function meetingLine(row: MeetingRow) {
  return `From the meeting “${row.event.title}” on ${formatMeetingTime(row.event.startTime, row.event.endTime)}.`;
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Turn an action item into a CRM follow-up (Task, assigned to the owner) or a project task
 * (owner as assignee; needs write access to that project). Marks the item converted.
 */
export async function convertActionItem(params: {
  meetingId: string;
  companyId: string;
  session: Session;
  itemId: string;
  kind: ConvertKind;
  projectId?: string | null;
}) {
  const { companyId, session } = params;
  const viewer: MeetingViewer = {
    userId: session.user.id,
    role: session.user.role ?? null,
    isWorkspaceStaff: session.user.role !== 'CUSTOMER',
  };
  const row = await getMeetingForViewer(params.meetingId, companyId, viewer);
  if (!canEditActionItems(viewer, accessShape(row))) throw new ApiException('Meeting not found', 404, 'NOT_FOUND');
  const notes = await loadNotes(row.id);
  const item = findItem(readActionItems(notes?.actionItems), params.itemId);
  if (item.followUpId || item.taskId) {
    throw new ApiException('This action item was already turned into a follow-up or task', 409, 'ALREADY_CONVERTED');
  }
  const owner = item.ownerUserId && (await isCompanyStaff(companyId, item.ownerUserId)) ? item.ownerUserId : null;
  const title = item.text.slice(0, 200);
  let patch: Partial<ActionItem>;
  let created: { kind: ConvertKind; id: string; title: string; projectId?: string };

  if (params.kind === 'follow-up') {
    const task = await prisma.task.create({
      data: {
        userId: viewer.userId,
        assignedToId: owner ?? viewer.userId,
        title,
        description: [item.text.length > 200 ? item.text : null, meetingLine(row)].filter(Boolean).join('\n\n'),
        type: 'FOLLOW_UP',
        priority: 'MEDIUM',
        status: 'PENDING',
        dueDate: item.dueDate ? new Date(`${item.dueDate}T12:00:00.000Z`) : null,
      },
      select: { id: true, title: true },
    });
    patch = { followUpId: task.id };
    created = { kind: 'follow-up', id: task.id, title: task.title };
  } else {
    const projectId = typeof params.projectId === 'string' ? params.projectId.trim() : '';
    if (!projectId) throw new ApiException('Choose a project', 400, 'BAD_REQUEST');
    if (!(await canWriteProjectDelivery(session, companyId, projectId))) {
      throw new ApiException('You can only add tasks to projects you lead or are a member of', 403, 'FORBIDDEN');
    }
    const result = await createProjectTask({
      session,
      companyId,
      projectId,
      body: {
        title,
        assigneeId: owner ?? undefined,
        dueDate: item.dueDate ?? undefined,
        descriptionHtml: `<p>${escapeHtml(item.text)}</p><p><em>${escapeHtml(meetingLine(row))}</em></p>`,
      },
    });
    if (!result.ok) throw new ApiException(result.error, result.status);
    await result.effects().catch((error) => logError(error, { context: 'meeting notes: project task effects' }));
    patch = { taskId: result.task.id, projectId };
    created = { kind: 'project-task', id: result.task.id, title: result.task.title, projectId };
  }

  const items = await mutateItems(row.id, (list) => list.map((i) => (i.id === item.id ? { ...i, ...patch } : i)));
  void publishMeetingChanged(row, accessShape(row).attendeeIds, viewer.userId);
  const byId = new Map(people(row).map((p) => [p.id, p]));
  return { item: toItemDTO(findItem(items, item.id), byId), created };
}

// ── Listing (OPS agent) ─────────────────────────────────────────────────────

const PERSON = { id: true, name: true, email: true } as const;

/**
 * Meetings the viewer can see (attendee/organizer; admins: the whole workspace),
 * filtered by scope, title, attendee name/email and date range.
 */
export async function listMeetingsForViewer(
  companyId: string,
  viewer: MeetingViewer,
  filters: { scope?: 'upcoming' | 'past' | 'all'; search?: string; attendee?: string; from?: Date; to?: Date; limit?: number }
) {
  const isAdmin = viewer.role === 'ADMIN' || viewer.role === 'SUPER_ADMIN';
  const now = new Date();
  const and: Record<string, unknown>[] = [{ companyId }];
  if (!isAdmin) and.push({ attendees: { some: { userId: viewer.userId } } });
  const event: Record<string, unknown> = {};
  if (filters.search) event.title = { contains: filters.search, mode: 'insensitive' };
  const startTime: Record<string, Date> = {};
  if (filters.from) startTime.gte = filters.from;
  if (filters.to) startTime.lte = filters.to;
  if (filters.scope === 'upcoming') {
    event.endTime = { gte: now };
    event.status = { not: 'CANCELLED' };
  } else if (filters.scope === 'past') {
    startTime.lte = startTime.lte && startTime.lte < now ? startTime.lte : now;
  }
  if (Object.keys(startTime).length) event.startTime = startTime;
  if (Object.keys(event).length) and.push({ event });
  if (filters.attendee) {
    and.push({
      attendees: {
        some: {
          user: {
            OR: [
              { name: { contains: filters.attendee, mode: 'insensitive' } },
              { email: { contains: filters.attendee, mode: 'insensitive' } },
            ],
          },
        },
      },
    });
  }
  const rows = await prisma.teamMeeting.findMany({
    where: { AND: and },
    include: {
      event: { select: { title: true, startTime: true, endTime: true, status: true } },
      organizer: { select: PERSON },
      attendees: { select: { userId: true, rsvp: true, user: { select: PERSON } } },
    },
    orderBy: { event: { startTime: filters.scope === 'upcoming' ? 'asc' : 'desc' } },
    take: Math.max(1, Math.min(50, filters.limit ?? 15)),
  });
  let notesByMeeting = new Map<string, NotesRow>();
  try {
    const notes = await prisma.meetingNotes.findMany({
      where: { meetingId: { in: (rows as any[]).map((r) => r.id) } },
      select: { meetingId: true, notesGeneratedAt: true, aiNotesEnabled: true, actionItems: true },
    });
    notesByMeeting = new Map((notes as any[]).map((n) => [n.meetingId, n]));
  } catch (error) {
    if (!isNotesSchemaMissing(error)) throw error;
  }
  return (rows as any[]).map((r) => {
    const n = notesByMeeting.get(r.id);
    return {
      id: r.id,
      title: r.event.title,
      startTime: iso(r.event.startTime),
      endTime: iso(r.event.endTime),
      status: r.event.status,
      provider: r.provider,
      organizer: r.organizer?.name || r.organizer?.email || null,
      attendees: (r.attendees as any[]).map((a) => ({ id: a.userId, name: a.user?.name || a.user?.email, rsvp: a.rsvp })),
      aiNotes: n
        ? {
            ready: !!n.notesGeneratedAt,
            capturing: !!n.aiNotesEnabled,
            openActionItems: readActionItems(n.actionItems).filter((i) => !i.done && !i.followUpId && !i.taskId).length,
          }
        : null,
    };
  });
}
