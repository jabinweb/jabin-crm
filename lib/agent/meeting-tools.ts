import type { Session } from 'next-auth';
import type { AgentToolDef } from '@/lib/agent/tool-types';
import type { AgentRuntimeContext } from '@/lib/agent/context';
import type { MeetingViewer } from '@/lib/meetings/rules';
import {
  buildNotesDTO,
  convertActionItem,
  generateMeetingNotes,
  getNotesForViewer,
  isNotesSchemaMissing,
  listMeetingsForViewer,
  NOTES_NOT_READY_MESSAGE,
  type ConvertKind,
} from '@/lib/meetings/ai-notes/service';
import { canControlNotes } from '@/lib/meetings/ai-notes/rules';
import { getMeetingForViewer, isMeetingsSchemaMissing, MEETINGS_NOT_READY_MESSAGE } from '@/lib/meetings/service';

/**
 * OPS agent tools for team meetings and their AI notes. Same workspace scoping and access
 * as the meetings API: organizer, invited people and workspace admins only (others get
 * "not found"), and the same write paths as the UI for follow-ups / project tasks.
 */

function viewerOf(ctx: AgentRuntimeContext): MeetingViewer {
  return { userId: ctx.userId, role: ctx.userRole, isWorkspaceStaff: ctx.userRole !== 'CUSTOMER' };
}

function agentSession(ctx: AgentRuntimeContext): Session {
  return {
    user: { id: ctx.userId, name: ctx.userName, role: ctx.userRole, companyId: ctx.companyId },
    expires: new Date(Date.now() + 60_000).toISOString(),
  } as unknown as Session;
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function date(v: unknown, field: string): Date | undefined {
  const s = str(v);
  if (!s) return undefined;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid ${field}: ${s}`);
  return d;
}

/** Turn "migration not applied" into a readable tool error instead of a Prisma dump. */
async function guard<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (isNotesSchemaMissing(error)) throw new Error(NOTES_NOT_READY_MESSAGE);
    if (isMeetingsSchemaMissing(error)) throw new Error(MEETINGS_NOT_READY_MESSAGE);
    throw error;
  }
}

const TRANSCRIPT_CHAR_LIMIT = 20_000;

export const MEETING_AGENT_TOOLS: AgentToolDef[] = [
  {
    name: 'list_meetings',
    description:
      'List team meetings the user can see (organizer, invited, or all for admins): upcoming or past, filtered by title, attendee name/email and date range. Shows whether AI notes exist and how many action items are open.',
    kind: 'read',
    parameters: {
      type: 'object',
      properties: {
        scope: { type: 'string', description: 'upcoming|past|all (default all)' },
        search: { type: 'string', description: 'Part of the meeting title' },
        attendee: { type: 'string', description: 'Attendee name or email (partial)' },
        from: { type: 'string', description: 'Start date (ISO) — meetings starting on/after' },
        to: { type: 'string', description: 'End date (ISO) — meetings starting on/before' },
        limit: { type: 'number', description: 'Max results (default 15, max 50)' },
      },
    },
    execute: async (args, ctx) =>
      guard(async () => {
        const scope = ['upcoming', 'past', 'all'].includes(String(args.scope)) ? (String(args.scope) as 'upcoming' | 'past' | 'all') : 'all';
        const meetings = await listMeetingsForViewer(ctx.companyId, viewerOf(ctx), {
          scope,
          search: str(args.search),
          attendee: str(args.attendee),
          from: date(args.from, 'from'),
          to: date(args.to, 'to'),
          limit: typeof args.limit === 'number' ? args.limit : undefined,
        });
        return { count: meetings.length, meetings };
      }),
  },
  {
    name: 'get_meeting_notes',
    description:
      'AI notes of a team meeting: summary, key points, action items (owner, due date, done, linked follow-up/task) and optionally the speaker-labelled transcript.',
    kind: 'read',
    parameters: {
      type: 'object',
      properties: {
        meetingId: { type: 'string', description: 'Meeting id from list_meetings' },
        includeTranscript: { type: 'boolean', description: 'Also return the transcript (truncated to ~20k chars)' },
      },
      required: ['meetingId'],
    },
    execute: async (args, ctx) =>
      guard(async () => {
        const { dto } = await getNotesForViewer(String(args.meetingId), ctx.companyId, viewerOf(ctx), {
          transcript: args.includeTranscript === true,
        });
        let transcript: string | undefined;
        if (dto.transcript) {
          const full = dto.transcript.map((l) => `[${l.startedAt.slice(11, 19)}] ${l.speakerName}: ${l.text}`).join('\n');
          transcript = full.length > TRANSCRIPT_CHAR_LIMIT ? `${full.slice(0, TRANSCRIPT_CHAR_LIMIT)}\n… (truncated)` : full;
        }
        return {
          meetingId: dto.meetingId,
          status: dto.generating ? 'generating' : dto.summary || dto.actionItems.length ? 'ready' : dto.segmentCount ? 'transcript only' : 'no notes',
          capturing: dto.enabled,
          generatedAt: dto.generatedAt,
          error: dto.error,
          summary: dto.summary,
          keyPoints: dto.keyPoints,
          actionItems: dto.actionItems.map((i) => ({
            id: i.id,
            text: i.text,
            owner: i.owner ? { id: i.owner.id, name: i.owner.name || i.owner.email } : i.ownerName ? { name: i.ownerName } : null,
            dueDate: i.dueDate,
            done: !!i.done,
            followUpId: i.followUpId,
            taskId: i.taskId,
            projectId: i.projectId,
          })),
          transcriptLines: dto.segmentCount,
          ...(transcript !== undefined ? { transcript } : {}),
        };
      }),
  },
  {
    name: 'summarize_meeting',
    description:
      'Regenerate the AI summary, key points and action items of a team meeting from its transcript (organizer or admin). Ticked and converted action items are kept. Requires confirmation.',
    kind: 'write',
    parameters: {
      type: 'object',
      properties: { meetingId: { type: 'string' } },
      required: ['meetingId'],
    },
    execute: async (args, ctx) =>
      guard(async () => {
        const viewer = viewerOf(ctx);
        const row = await getMeetingForViewer(String(args.meetingId), ctx.companyId, viewer);
        if (!canControlNotes(viewer, { organizerId: row.organizerId, attendeeIds: row.attendees.map((a: { userId: string }) => a.userId) })) {
          throw new Error('Only the organizer or a workspace admin can regenerate meeting notes');
        }
        const result = await generateMeetingNotes(row, { actorId: ctx.userId });
        if (!result.ok) throw new Error(result.error);
        const { dto } = await buildNotesDTO(row, viewer);
        return {
          meetingId: dto.meetingId,
          summary: dto.summary,
          keyPoints: dto.keyPoints,
          actionItems: dto.actionItems.map((i) => ({ id: i.id, text: i.text, owner: i.owner?.name || i.ownerName || null, dueDate: i.dueDate })),
        };
      }),
  },
  {
    name: 'create_tasks_from_meeting_action_items',
    description:
      'Turn a meeting\'s AI action items into CRM follow-ups (kind "follow-up", assigned to each item\'s owner) or project tasks (kind "project-task" with projectId; owner becomes assignee). Defaults to every open item not yet converted. Marks items as converted. Requires confirmation.',
    kind: 'write',
    parameters: {
      type: 'object',
      properties: {
        meetingId: { type: 'string' },
        kind: { type: 'string', description: 'follow-up|project-task' },
        projectId: { type: 'string', description: 'Required for project-task (from list_projects)' },
        itemIds: { type: 'array', items: { type: 'string' }, description: 'Action item ids from get_meeting_notes; omit for all open items' },
      },
      required: ['meetingId', 'kind'],
    },
    execute: async (args, ctx) =>
      guard(async () => {
        const kind = String(args.kind) === 'project-task' ? 'project-task' : String(args.kind) === 'follow-up' ? 'follow-up' : null;
        if (!kind) throw new Error('kind must be follow-up or project-task');
        const projectId = str(args.projectId);
        if (kind === 'project-task' && !projectId) throw new Error('projectId is required for project tasks');
        const meetingId = String(args.meetingId);
        const { dto } = await getNotesForViewer(meetingId, ctx.companyId, viewerOf(ctx));
        const wanted = Array.isArray(args.itemIds) ? new Set(args.itemIds.map(String)) : null;
        const targets = dto.actionItems.filter((i) =>
          wanted ? wanted.has(i.id) : !i.done && !i.followUpId && !i.taskId
        );
        if (targets.length === 0) return { created: [], skipped: [], message: 'No open action items to convert.' };
        const created: unknown[] = [];
        const skipped: Array<{ id: string; reason: string }> = [];
        for (const item of targets) {
          if (item.followUpId || item.taskId) {
            skipped.push({ id: item.id, reason: 'already converted' });
            continue;
          }
          try {
            const result = await convertActionItem({
              meetingId,
              companyId: ctx.companyId,
              session: agentSession(ctx),
              itemId: item.id,
              kind: kind as ConvertKind,
              projectId,
            });
            created.push({ itemId: item.id, ...result.created, owner: result.item.owner?.name || result.item.ownerName || null });
          } catch (error) {
            skipped.push({ id: item.id, reason: error instanceof Error ? error.message : 'failed' });
          }
        }
        if (wanted) for (const id of Array.from(wanted)) if (!targets.some((t) => t.id === id)) skipped.push({ id, reason: 'not found' });
        return { created, skipped };
      }),
  },
];
