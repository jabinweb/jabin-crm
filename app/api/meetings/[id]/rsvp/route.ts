import { NextResponse } from 'next/server';
import { respondToMeeting, toMeetingDTO } from '@/lib/meetings/service';
import { meetingViewer, withMeetingsRoute } from '@/lib/meetings/route';

/** POST /api/meetings/:id/rsvp { rsvp: ACCEPTED | DECLINED | TENTATIVE } */
export const POST = withMeetingsRoute(async (request, { session, companyId }, routeContext) => {
  const { id } = await routeContext.params;
  const body = (await request.json().catch(() => null)) ?? {};
  const viewer = meetingViewer(session);
  const row = await respondToMeeting(id, companyId, viewer, body.rsvp);
  return NextResponse.json({ meeting: toMeetingDTO(row, viewer) });
});
