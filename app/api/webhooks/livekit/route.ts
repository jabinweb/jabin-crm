/**
 * LiveKit webhook — keeps "who is in the room" exact (participant joined/left, room finished).
 * Point LiveKit Cloud → Settings → Webhooks (or livekit.yaml `webhook.urls`) at
 *   https://<app>/api/webhooks/livekit
 * Requests are signed with the LiveKit API key/secret (Admin → Settings, else env). Optional: without it the
 * app still tracks presence from token requests, the leave call, and room reconciliation.
 */
import { NextRequest, NextResponse, after } from 'next/server';
import { finalizeNotesAfterEnd } from '@/lib/meetings/ai-notes/service';
import { WebhookReceiver } from 'livekit-server-sdk';
import { prisma } from '@/lib/prisma';
import { MEETING_INCLUDE, markJoined, markLeft } from '@/lib/meetings/service';
import { publishMeetingChanged } from '@/lib/meetings/notifications';
import { logError } from '@/lib/logger';
import { getLiveKitConfig } from '@/lib/meetings/livekit-config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const { apiKey, apiSecret } = await getLiveKitConfig();
  if (!apiKey || !apiSecret) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

  const body = await request.text();
  const authHeader = request.headers.get('authorization') ?? undefined;
  let event;
  try {
    event = await new WebhookReceiver(apiKey, apiSecret).receive(body, authHeader);
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const roomName = event.room?.name;
  if (!roomName) return NextResponse.json({ ok: true });

  try {
    const row = await prisma.teamMeeting.findUnique({
      where: { roomName },
      include: MEETING_INCLUDE,
    });
    if (!row) return NextResponse.json({ ok: true });
    const identity = event.participant?.identity;

    if (event.event === 'participant_joined' && identity) {
      // Token route already marked them; this corrects reconnects from other devices
      const attendee = row.attendees.find((a: { userId: string }) => a.userId === identity);
      if (attendee && !attendee.inRoom) {
        await markJoined(row, { id: identity, name: event.participant?.name });
      }
    } else if (event.event === 'participant_left' && identity) {
      await markLeft(row, identity);
    } else if (event.event === 'room_finished') {
      await prisma.meetingAttendee.updateMany({
        where: { meetingId: row.id, inRoom: true },
        data: { inRoom: false, leftAt: new Date() },
      });
      await publishMeetingChanged(
        row,
        row.attendees.map((a: { userId: string }) => a.userId)
      );
      // Everyone left: stop AI-notes capture and write the summary (no-op without notes)
      after(() => finalizeNotesAfterEnd(row.id, row.companyId));
    }
  } catch (error) {
    logError(error, { context: 'livekit webhook', event: event.event });
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
