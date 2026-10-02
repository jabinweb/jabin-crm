import { NextRequest, NextResponse } from 'next/server';
import { sendDueMeetingReminders } from '@/lib/meetings/service';

/**
 * Team meeting reminders (respects each meeting's reminderMinutes; default 10).
 * Schedule every 5 minutes from an external cron (Vercel Hobby crons run once a day):
 *   GET /api/cron/meeting-reminders  with  Authorization: Bearer $CRON_SECRET
 * The header poll (/api/meetings/now) also sends due reminders while anyone is online.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await sendDueMeetingReminders();
    return NextResponse.json({ success: true, ...result, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('[api/cron/meeting-reminders]', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
