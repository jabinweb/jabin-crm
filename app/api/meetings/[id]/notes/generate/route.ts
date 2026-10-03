import { NextResponse } from 'next/server';
import { regenerateNotes } from '@/lib/meetings/ai-notes/service';
import { withNotesRoute } from '@/lib/meetings/ai-notes/route';
import { meetingViewer } from '@/lib/meetings/route';

export const maxDuration = 60;

/** POST /api/meetings/:id/notes/generate — organizer/admin: (re)write summary + action items now. */
export const POST = withNotesRoute(async (_request, { session, companyId }, routeContext) => {
  const { id } = await routeContext.params;
  const notes = await regenerateNotes(id, companyId, meetingViewer(session));
  return NextResponse.json({ notes });
});
