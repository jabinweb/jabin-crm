import { NextResponse } from 'next/server';
import { createMeeting, listMeetingsForUser, toMeetingDTO } from '@/lib/meetings/service';
import { isLiveKitConfigured } from '@/lib/meetings/livekit';
import { meetingViewer, withMeetingsRoute } from '@/lib/meetings/route';
import type { MeetingListResponse } from '@/lib/meetings/types';

/** GET /api/meetings?scope=upcoming|past — the caller's meetings in this workspace. */
export const GET = withMeetingsRoute(async (request, { session, companyId }) => {
  const scope = request.nextUrl.searchParams.get('scope') === 'past' ? 'past' : 'upcoming';
  const viewer = meetingViewer(session);
  const rows = await listMeetingsForUser(companyId, viewer.userId, scope);
  const body: MeetingListResponse = {
    meetings: rows.map((row: unknown) => toMeetingDTO(row, viewer)),
    video: { configured: isLiveKitConfigured() },
  };
  return NextResponse.json(body);
});

/** POST /api/meetings — schedule a team meeting (optionally repeating) and invite teammates. */
export const POST = withMeetingsRoute(async (request, { session, companyId }) => {
  const body = (await request.json().catch(() => null)) ?? {};
  const viewer = meetingViewer(session);
  if (body.provider === undefined) body.provider = isLiveKitConfigured() ? 'OPSLANE' : 'NONE';
  if (body.provider === 'OPSLANE' && !isLiveKitConfigured()) {
    return NextResponse.json(
      { error: 'Built-in video is not set up for this workspace yet. Use a meeting link instead.' },
      { status: 400 }
    );
  }
  const { first, count } = await createMeeting(
    companyId,
    { id: viewer.userId, name: viewer.name },
    body
  );
  return NextResponse.json({ meeting: toMeetingDTO(first, viewer), count }, { status: 201 });
});
