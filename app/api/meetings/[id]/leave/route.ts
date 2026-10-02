import { NextResponse } from 'next/server';
import { getMeetingForViewer, markLeft } from '@/lib/meetings/service';
import { meetingViewer, withMeetingsRoute } from '@/lib/meetings/route';

/**
 * POST /api/meetings/:id/leave — the client left the room (also sent with sendBeacon on
 * tab close). The LiveKit webhook, when configured, is the authoritative signal.
 */
export const POST = withMeetingsRoute(async (_request, { session, companyId }, routeContext) => {
  const { id } = await routeContext.params;
  const viewer = meetingViewer(session);
  const row = await getMeetingForViewer(id, companyId, viewer);
  await markLeft(row, viewer.userId);
  return NextResponse.json({ ok: true });
});
