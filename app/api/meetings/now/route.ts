import { NextResponse } from 'next/server';
import { meetingsNowForUser, sendDueMeetingReminders, toMeetingDTO } from '@/lib/meetings/service';
import { meetingViewer, withMeetingsRoute } from '@/lib/meetings/route';
import { isLiveKitConfigured } from '@/lib/meetings/livekit';
import { logError } from '@/lib/logger';
import type { MeetingsNowResponse } from '@/lib/meetings/types';

/** Last opportunistic reminder sweep per workspace (per server instance). */
const lastSweep = new Map<string, number>();
const SWEEP_EVERY_MS = 60_000;

/**
 * GET /api/meetings/now — header indicator: meetings that are live or start within
 * 15 minutes, plus the number of invitations awaiting a reply. Polled every minute by
 * signed-in staff, so it also sends due reminders for the workspace — this keeps
 * reminders on time even where the platform cron runs only once a day.
 */
export const GET = withMeetingsRoute(async (_request, { session, companyId }) => {
  const viewer = meetingViewer(session);

  const last = lastSweep.get(companyId) ?? 0;
  if (Date.now() - last > SWEEP_EVERY_MS) {
    lastSweep.set(companyId, Date.now());
    void sendDueMeetingReminders({ companyId, limit: 100 }).catch((error) =>
      logError(error, { context: 'meeting reminders (header sweep)' })
    );
  }

  const { rows, pendingInvites } = await meetingsNowForUser(companyId, viewer.userId);
  const body: MeetingsNowResponse = {
    meetings: rows.map((row: unknown) => toMeetingDTO(row, viewer)),
    pendingInvites,
    video: { configured: isLiveKitConfigured() },
    ready: true,
  };
  return NextResponse.json(body);
});
