import { NextRequest, NextResponse } from 'next/server';
import { slaService } from '@/lib/crm/sla-service';

/** SLA sweep — also runs in `/api/cron/daily-tasks` (Hobby: once/day). Call manually or use external cron on Pro for 15-min intervals. */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await slaService.runEscalationSweep();
    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[api/cron/sla-escalations]', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
