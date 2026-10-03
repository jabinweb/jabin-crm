import { NextResponse, after } from 'next/server';
import { endMeeting } from '@/lib/meetings/service';
import { finalizeNotesAfterEnd } from '@/lib/meetings/ai-notes/service';
import { meetingViewer, withMeetingsRoute } from '@/lib/meetings/route';

// The AI-notes summary runs after the response (see finalizeNotesAfterEnd)
export const maxDuration = 60;

/** POST /api/meetings/:id/end — organizer/admin: disconnect everyone and mark it done. */
export const POST = withMeetingsRoute(async (_request, { session, companyId }, routeContext) => {
  const { id } = await routeContext.params;
  await endMeeting(id, companyId, meetingViewer(session));
  // Stop AI-notes capture and write the summary once the last clips have landed
  after(() => finalizeNotesAfterEnd(id, companyId));
  return NextResponse.json({ ok: true });
});
