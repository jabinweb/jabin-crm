import { NextResponse } from 'next/server';
import {
  cancelMeeting,
  getMeetingForViewer,
  reconcileRoomPresence,
  toMeetingDTO,
  updateMeeting,
} from '@/lib/meetings/service';
import { isLiveKitConfigured } from '@/lib/meetings/livekit';
import { meetingViewer, withMeetingsRoute } from '@/lib/meetings/route';

/** GET /api/meetings/:id — details for the organizer, attendees and workspace admins. */
export const GET = withMeetingsRoute(async (_request, { session, companyId }, routeContext) => {
  const { id } = await routeContext.params;
  const viewer = meetingViewer(session);
  const row = await reconcileRoomPresence(await getMeetingForViewer(id, companyId, viewer));
  return NextResponse.json({
    meeting: toMeetingDTO(row, viewer),
    video: { configured: await isLiveKitConfigured() },
  });
});

/** PATCH /api/meetings/:id — organizer/admin edits (time, guests, link, agenda). */
export const PATCH = withMeetingsRoute(async (request, { session, companyId }, routeContext) => {
  const { id } = await routeContext.params;
  const body = (await request.json().catch(() => null)) ?? {};
  const viewer = meetingViewer(session);
  const row = await updateMeeting(id, companyId, viewer, body);
  return NextResponse.json({ meeting: toMeetingDTO(row, viewer) });
});

/** DELETE /api/meetings/:id[?series=1] — cancel (kept on calendars, struck through). */
export const DELETE = withMeetingsRoute(async (request, { session, companyId }, routeContext) => {
  const { id } = await routeContext.params;
  const series = request.nextUrl.searchParams.get('series') === '1';
  const timeZone = request.nextUrl.searchParams.get('tz');
  const result = await cancelMeeting(id, companyId, meetingViewer(session), { series, timeZone });
  return NextResponse.json(result);
});
