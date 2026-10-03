import { NextResponse, after } from 'next/server';
import { autoGenerateNotes, getNotesForViewer, setNotesEnabled } from '@/lib/meetings/ai-notes/service';
import { withNotesRoute } from '@/lib/meetings/ai-notes/route';
import { meetingViewer } from '@/lib/meetings/route';

export const maxDuration = 60;

/**
 * GET /api/meetings/:id/notes[?view=status] — AI notes for anyone who can see the meeting.
 * `view=status` (polled in the room) skips the transcript. Viewing a finished meeting whose
 * summary is missing or older than the transcript writes it in the background.
 */
export const GET = withNotesRoute(async (request, { session, companyId }, routeContext) => {
  const { id } = await routeContext.params;
  const statusOnly = request.nextUrl.searchParams.get('view') === 'status';
  const { dto, autoGenerate } = await getNotesForViewer(id, companyId, meetingViewer(session), {
    transcript: !statusOnly,
    checkAi: !statusOnly,
  });
  if (autoGenerate) after(() => autoGenerateNotes(id, companyId));
  return NextResponse.json({ notes: dto });
});

/** PATCH /api/meetings/:id/notes { enabled } — organizer/admin turns live capture on or off. */
export const PATCH = withNotesRoute(async (request, { session, companyId }, routeContext) => {
  const { id } = await routeContext.params;
  const body = (await request.json().catch(() => null)) ?? {};
  if (typeof body.enabled !== 'boolean') {
    return NextResponse.json({ error: 'enabled must be true or false' }, { status: 400 });
  }
  const notes = await setNotesEnabled(id, companyId, meetingViewer(session), body.enabled);
  return NextResponse.json({ notes });
});
