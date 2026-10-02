import { NextRequest, NextResponse } from 'next/server';
import { sequenceService } from '@/lib/crm/sequence-service';

export async function GET(req: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = req.headers.get('authorization');
    if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await sequenceService.processDueSteps();
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error processing sequences:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
