/**
 * AI meeting notes — pure rules shared by the API, the OPS agent, the client and tests
 * (no Prisma, no Gemini, no React): limits, who may do what, summary parsing,
 * owner matching, transcript formatting and action-item merging.
 */
import { canManageMeeting, canViewMeeting, type MeetingAccessShape, type MeetingViewer } from '../rules';

// ── Capture limits ───────────────────────────────────────────────────────────

/** Each client sends its own mic in clips of about this length. */
export const CLIP_SECONDS = 25;
/** 16 kHz mono 16-bit WAV ≈ 32 KB/s → a 25 s clip ≈ 800 KB; leave room for a late flush. */
export const MAX_CLIP_BYTES = 2 * 1024 * 1024;
export const MAX_CLIP_MS = 45_000;
/** Per person per meeting: clips allowed per minute (normal pace is 2–3). */
export const CLIP_RATE_PER_MINUTE = 6;
/** Hard cap on transcript rows per meeting (≈ 8 h with 6 people talking). */
export const MAX_SEGMENTS_PER_MEETING = 4000;
export const MAX_SEGMENT_CHARS = 4000;
/** Clip uploads still accepted this long after "End for everyone" (last flush in flight). */
export const LATE_CLIP_GRACE_MS = 2 * 60_000;
/** A summary claim older than this is considered dead and can be retaken. */
export const GENERATION_STALE_MS = 3 * 60_000;
/** Transcript characters sent to the summary model. */
export const MAX_SUMMARY_INPUT_CHARS = 200_000;

export const ALLOWED_AUDIO_TYPES = ['audio/wav', 'audio/x-wav', 'audio/wave', 'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg'];

// ── Shapes ───────────────────────────────────────────────────────────────────

export type ActionItem = {
  id: string;
  text: string;
  ownerUserId?: string | null;
  /** Name as said in the meeting (or the matched attendee's name) */
  ownerName?: string | null;
  /** YYYY-MM-DD */
  dueDate?: string | null;
  done?: boolean;
  /** CRM follow-up (Task) created from this item */
  followUpId?: string | null;
  /** Project task created from this item */
  taskId?: string | null;
  projectId?: string | null;
};

export type ParsedNotes = {
  summary: string;
  keyPoints: string[];
  actionItems: Array<{ text: string; owner: string | null; dueDate: string | null }>;
};

export type NotesPerson = { id: string; name: string | null; email: string };

// ── Access ───────────────────────────────────────────────────────────────────

/** Read notes and transcript: anyone who can see the meeting. */
export function canViewNotes(viewer: MeetingViewer, meeting: MeetingAccessShape) {
  return canViewMeeting(viewer, meeting);
}

/** Turn AI notes on/off and regenerate: organizer or workspace admin. */
export function canControlNotes(viewer: MeetingViewer, meeting: MeetingAccessShape) {
  return canManageMeeting(viewer, meeting);
}

/**
 * Upload your own microphone: invited people (organizer included) and workspace admins
 * who joined the room — exactly who may be in the room.
 */
export function canContributeAudio(viewer: MeetingViewer, meeting: MeetingAccessShape) {
  return canViewMeeting(viewer, meeting);
}

/** Tick items and turn them into follow-ups/tasks: anyone who can see the meeting. */
export function canEditActionItems(viewer: MeetingViewer, meeting: MeetingAccessShape) {
  return canViewMeeting(viewer, meeting);
}

export type ClipCheck = { ok: true } | { ok: false; status: number; error: string; code?: string };

/** Server gate for one uploaded clip (after the viewer was authorized). */
export function checkClipAccepted(args: {
  notesEnabled: boolean;
  meetingStatus: string;
  provider: string;
  endedAt: Date | string | null;
  startTime: Date | string;
  segmentCount: number;
  size: number;
  mediaType: string;
  now?: Date;
}): ClipCheck {
  const now = (args.now ?? new Date()).getTime();
  if (args.provider !== 'OPSLANE') return { ok: false, status: 409, error: 'AI notes work in Opslane video rooms only.' };
  if (args.meetingStatus === 'CANCELLED') return { ok: false, status: 409, error: 'This meeting was cancelled.' };
  if (!args.notesEnabled) return { ok: false, status: 409, error: 'AI notes are off for this meeting.', code: 'NOTES_OFF' };
  const ended = args.endedAt ? new Date(args.endedAt).getTime() : null;
  if (ended && ended > new Date(args.startTime).getTime() && now - ended > LATE_CLIP_GRACE_MS) {
    return { ok: false, status: 409, error: 'This meeting has ended.', code: 'NOTES_OFF' };
  }
  if (args.size <= 0) return { ok: false, status: 400, error: 'Empty clip' };
  if (args.size > MAX_CLIP_BYTES) return { ok: false, status: 413, error: 'Clip too large' };
  if (!ALLOWED_AUDIO_TYPES.includes(args.mediaType)) return { ok: false, status: 415, error: 'Unsupported audio type' };
  if (args.segmentCount >= MAX_SEGMENTS_PER_MEETING) {
    return { ok: false, status: 409, error: 'This meeting reached the transcript limit.', code: 'NOTES_FULL' };
  }
  return { ok: true };
}

/**
 * Client clock → stored clip start. Clamped into [meeting start − 1 h, now] so a wrong
 * clock can't push lines out of the meeting; falls back to "now − duration".
 */
export function clampClipStart(raw: unknown, durationMs: number, meetingStart: Date | string, now: Date = new Date()) {
  const fallback = now.getTime() - Math.max(0, durationMs);
  const n = typeof raw === 'string' || typeof raw === 'number' ? Number(raw) : NaN;
  const value = Number.isFinite(n) && n > 0 ? n : fallback;
  const min = new Date(meetingStart).getTime() - 60 * 60_000;
  return new Date(Math.round(Math.min(now.getTime(), Math.max(min, value))));
}

// ── Transcription output ─────────────────────────────────────────────────────

/** Model reply for one clip → clean text, or "" when it heard nothing worth keeping. */
export function cleanClipText(raw: string | null | undefined) {
  let text = (raw ?? '').trim();
  text = text.replace(/^```(?:text)?\s*\n?/i, '').replace(/\n?```\s*$/, '').trim();
  if (!text) return '';
  if (/^\[?\s*(silence|no speech|inaudible|no audible speech|music|noise)\s*\]?\.?$/i.test(text)) return '';
  // Drop bracketed sound descriptions the model sometimes adds anyway
  text = text.replace(/\[(?:silence|inaudible|music|noise|laughter|background noise)\]/gi, '').replace(/[ \t]+/g, ' ').trim();
  return text.slice(0, MAX_SEGMENT_CHARS);
}

// ── Transcript formatting ────────────────────────────────────────────────────

export type TranscriptSegment = {
  id?: string;
  speakerId: string;
  speakerName: string;
  startedAt: Date | string;
  text: string;
};

function clock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${h ? `${h}:` : ''}${pad(m)}:${pad(sec)}`;
}

/** Order lines by when the clip started (ties: speaker name) — uploads arrive out of order. */
export function sortSegments<T extends TranscriptSegment>(segments: T[]): T[] {
  return [...segments].sort((a, b) => {
    const d = new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime();
    return d !== 0 ? d : a.speakerName.localeCompare(b.speakerName);
  });
}

/** "[04:12] Asha: …" lines, times relative to `origin` (meeting start or the first line). */
export function formatTranscript(segments: TranscriptSegment[], origin?: Date | string | null) {
  const sorted = sortSegments(segments);
  if (sorted.length === 0) return '';
  const base = origin ? new Date(origin).getTime() : new Date(sorted[0].startedAt).getTime();
  const first = new Date(sorted[0].startedAt).getTime();
  const zero = Math.min(base, first);
  return sorted
    .map((s) => `[${clock(new Date(s.startedAt).getTime() - zero)}] ${s.speakerName}: ${s.text.replace(/\s*\n+\s*/g, ' ')}`)
    .join('\n');
}

// ── Summary parsing ──────────────────────────────────────────────────────────

function extractJson(raw: string): unknown {
  const text = raw.trim().replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/, '').trim();
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function cleanString(v: unknown, max: number) {
  if (typeof v !== 'string') return '';
  return v.replace(/\s+/g, ' ').trim().slice(0, max);
}

/** YYYY-MM-DD that is a real calendar date, else null. */
export function normalizeDueDate(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const m = v.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== `${m[1]}-${m[2]}-${m[3]}`) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

/**
 * The summary model's JSON → validated notes. Tolerates code fences, prose around the JSON,
 * alternative keys (bullets / action_items / assignee / due) and string-only action items.
 * Returns null when nothing usable came back.
 */
export function parseNotesResponse(raw: string | null | undefined): ParsedNotes | null {
  if (!raw) return null;
  const data = extractJson(raw);
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const obj = data as Record<string, unknown>;

  const summary = cleanString(obj.summary, 4000);
  const pointsRaw = Array.isArray(obj.keyPoints) ? obj.keyPoints : Array.isArray(obj.key_points) ? obj.key_points : Array.isArray(obj.bullets) ? obj.bullets : [];
  const keyPoints = pointsRaw
    .map((p) => cleanString(p, 500))
    .filter(Boolean)
    .slice(0, 15);

  const itemsRaw = Array.isArray(obj.actionItems) ? obj.actionItems : Array.isArray(obj.action_items) ? obj.action_items : [];
  const actionItems: ParsedNotes['actionItems'] = [];
  for (const item of itemsRaw) {
    if (typeof item === 'string') {
      const text = cleanString(item, 500);
      if (text) actionItems.push({ text, owner: null, dueDate: null });
      continue;
    }
    if (!item || typeof item !== 'object') continue;
    const it = item as Record<string, unknown>;
    const text = cleanString(it.text ?? it.task ?? it.title ?? it.description, 500);
    if (!text) continue;
    const owner = cleanString(it.owner ?? it.assignee ?? it.ownerName ?? it.who, 120) || null;
    const dueDate = normalizeDueDate(it.dueDate ?? it.due_date ?? it.due);
    actionItems.push({ text, owner: owner && !/^(none|null|unknown|n\/a|team|everyone|all)$/i.test(owner) ? owner : null, dueDate });
  }

  if (!summary && keyPoints.length === 0 && actionItems.length === 0) return null;
  return { summary, keyPoints, actionItems: actionItems.slice(0, 30) };
}

// ── Owner matching ───────────────────────────────────────────────────────────

function norm(s: string) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9@. ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Match a name said in the meeting to an attendee — only when confident:
 * exact full name or email, else a unique first name / unique email local part,
 * else a unique last name. Ambiguous or unknown → null (the item keeps the spoken name).
 */
export function matchOwner(name: string | null | undefined, people: NotesPerson[]): NotesPerson | null {
  if (!name) return null;
  const target = norm(name.replace(/^@/, ''));
  if (!target || people.length === 0) return null;

  const unique = (list: NotesPerson[]) => (list.length === 1 ? list[0] : null);
  const full = people.filter((p) => (p.name && norm(p.name) === target) || norm(p.email) === target);
  if (full.length) return unique(full);

  const tokens = target.split(' ');
  const first = tokens[0];
  if (tokens.length === 1) {
    const byFirst = people.filter((p) => p.name && norm(p.name).split(' ')[0] === first);
    if (byFirst.length) return unique(byFirst);
    const byLocal = people.filter((p) => norm(p.email.split('@')[0]).replace(/[. ]/g, '') === first);
    if (byLocal.length) return unique(byLocal);
    const byLast = people.filter((p) => {
      const parts = p.name ? norm(p.name).split(' ') : [];
      return parts.length > 1 && parts[parts.length - 1] === first;
    });
    return unique(byLast);
  }
  // "Asha K" / "Asha Kumar" against "Asha Kumari": first name equal and last initial agrees
  const lastInitial = tokens[tokens.length - 1][0];
  const close = people.filter((p) => {
    const parts = p.name ? norm(p.name).split(' ') : [];
    return parts[0] === first && parts.length > 1 && parts[parts.length - 1][0] === lastInitial;
  });
  return unique(close);
}

/** Model output → stored action items with owners resolved to attendee ids when confident. */
export function buildActionItems(
  parsed: ParsedNotes['actionItems'],
  people: NotesPerson[],
  makeId: () => string
): ActionItem[] {
  return parsed.map((item) => {
    const owner = matchOwner(item.owner, people);
    return {
      id: makeId(),
      text: item.text,
      ownerUserId: owner?.id ?? null,
      ownerName: owner ? owner.name || owner.email : item.owner,
      dueDate: item.dueDate,
      done: false,
      followUpId: null,
      taskId: null,
      projectId: null,
    };
  });
}

function itemKey(text: string) {
  return norm(text).replace(/[^a-z0-9]/g, '');
}

/**
 * Regenerating keeps what people already did: a new item with the same text inherits
 * done / follow-up / task links; old items that were ticked or converted but are no longer
 * in the new list are kept at the end so nothing linked disappears.
 */
export function mergeActionItems(previous: ActionItem[], next: ActionItem[]): ActionItem[] {
  const touched = previous.filter((p) => p.done || p.followUpId || p.taskId);
  const used = new Set<string>();
  const merged = next.map((item) => {
    const match = touched.find((p) => !used.has(p.id) && itemKey(p.text) === itemKey(item.text));
    if (!match) return item;
    used.add(match.id);
    return {
      ...item,
      id: match.id,
      done: match.done ?? false,
      followUpId: match.followUpId ?? null,
      taskId: match.taskId ?? null,
      projectId: match.projectId ?? null,
      ownerUserId: item.ownerUserId ?? match.ownerUserId ?? null,
      ownerName: item.ownerName ?? match.ownerName ?? null,
    };
  });
  return [...merged, ...touched.filter((p) => !used.has(p.id))];
}

/** Stored JSON → typed lists (defensive: older rows or hand edits). */
export function readActionItems(value: unknown): ActionItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is Record<string, unknown> => !!v && typeof v === 'object' && typeof (v as { id?: unknown }).id === 'string' && typeof (v as { text?: unknown }).text === 'string')
    .map((v) => ({
      id: v.id as string,
      text: v.text as string,
      ownerUserId: typeof v.ownerUserId === 'string' ? v.ownerUserId : null,
      ownerName: typeof v.ownerName === 'string' ? v.ownerName : null,
      dueDate: normalizeDueDate(v.dueDate),
      done: v.done === true,
      followUpId: typeof v.followUpId === 'string' ? v.followUpId : null,
      taskId: typeof v.taskId === 'string' ? v.taskId : null,
      projectId: typeof v.projectId === 'string' ? v.projectId : null,
    }));
}

export function readKeyPoints(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

/** Gemini errors that are temporary (overloaded, rate limited, timed out). */
export function isAiBusyError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /high demand|UNAVAILABLE|overloaded|timed out|503|429|RESOURCE_EXHAUSTED|quota/i.test(message);
}
