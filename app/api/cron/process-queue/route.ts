import { NextRequest, NextResponse } from 'next/server';
import { emailQueueService } from '@/lib/crm/email-queue-service';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = req.headers.get('authorization');
    if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all active users
    const users = await prisma.user.findMany({
      where: {
        emailVerified: { not: null },
      },
      select: { id: true },
    });

    // processQueue() handles every user's pending mail in one pass; running it once per
    // user concurrently picked up the same PENDING rows several times (duplicate sends).
    const result: any = await emailQueueService.processQueue();

    return NextResponse.json({
      users: users.length,
      totalSent: result?.sent || 0,
      processed: 1,
    });
  } catch (error: any) {
    console.error('Error processing email queue:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
