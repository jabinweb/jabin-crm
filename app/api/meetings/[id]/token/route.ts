import { NextResponse } from 'next/server';
import { loadMeeting, markJoined } from '@/lib/meetings/service';
import {
  getLiveKitServerUrl,
  isLiveKitConfigured,
  mintLiveKitAccessToken,
} from '@/lib/meetings/livekit';
import { decideRoomToken } from '@/lib/meetings/rules';
import { meetingViewer, withMeetingsRoute } from '@/lib/meetings/route';
import { logError } from '@/lib/logger';

/**
 * POST /api/meetings/:id/token — mint a LiveKit access token for an invited attendee,
 * the organizer, or a workspace admin. Identity and display name come from the session;
 * room name comes from the database (never from the client).
 */
export const POST = withMeetingsRoute(async (_request, { session, companyId }, routeContext) => {
  const { id } = await routeContext.params;
  const viewer = meetingViewer(session);
  const row = await loadMeeting(id, companyId);
  if (!row) return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });

  const decision = decideRoomToken({
    viewer,
    meeting: {
      organizerId: row.organizerId,
      attendeeIds: row.attendees.map((a: { userId: string }) => a.userId),
      provider: row.provider,
      status: row.event.status,
      startTime: row.event.startTime,
      endTime: row.event.endTime,
      endedAt: row.endedAt,
    },
    liveKitConfigured: await isLiveKitConfigured(),
  });
  if (!decision.ok) {
    return NextResponse.json({ error: decision.error, code: decision.code }, { status: decision.status });
  }

  try {
    const token = await mintLiveKitAccessToken({
      identity: viewer.userId,
      name: session.user.name || session.user.email || 'Teammate',
      roomName: row.roomName,
      roomAdmin: decision.roomAdmin,
      attributes: { role: decision.roomAdmin ? 'host' : 'participant' },
    });
    // Presence is best-effort; never block someone from joining over it
    await markJoined(row, { id: viewer.userId, name: session.user.name }).catch((error) =>
      logError(error, { context: 'meeting markJoined failed', meetingId: id })
    );
    return NextResponse.json({
      token,
      url: await getLiveKitServerUrl(),
      isHost: decision.roomAdmin,
    });
  } catch (error) {
    logError(error, { context: 'livekit token mint failed', meetingId: id });
    return NextResponse.json({ error: 'Could not open the video room. Try again.' }, { status: 500 });
  }
});
