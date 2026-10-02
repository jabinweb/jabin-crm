import { NextResponse } from 'next/server';
import { endMeeting } from '@/lib/meetings/service';
import { meetingViewer, withMeetingsRoute } from '@/lib/meetings/route';

/** POST /api/meetings/:id/end — organizer/admin: disconnect everyone and mark it done. */
export const POST = withMeetingsRoute(async (_request, { session, companyId }, routeContext) => {
  const { id } = await routeContext.params;
  await endMeeting(id, companyId, meetingViewer(session));
  return NextResponse.json({ ok: true });
});
