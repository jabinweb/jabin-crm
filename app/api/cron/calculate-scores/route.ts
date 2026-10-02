import { NextRequest, NextResponse } from 'next/server';
import { leadScoringService } from '@/lib/crm/lead-scoring-service';
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

    const results = await Promise.allSettled(
      users.map((user) => leadScoringService.calculateAllScores(user.id))
    );

    const totalScored = results
      .filter((r) => r.status === 'fulfilled')
      .reduce((sum, r: any) => sum + r.value.succeeded, 0);

    return NextResponse.json({
      users: users.length,
      totalScored,
      processed: results.length,
    });
  } catch (error: any) {
    console.error('Error calculating scores:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
