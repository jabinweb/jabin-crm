import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Total emails sent
    const totalSent = await prisma.emailLog.count({
      where: { userId, status: { in: ['SENT', 'DELIVERED', 'OPENED', 'CLICKED', 'REPLIED'] } },
    });

    // Email engagement metrics
    const opened = await prisma.emailLog.count({
      where: { userId, openedAt: { not: null } },
    });

    const clicked = await prisma.emailLog.count({
      where: { userId, clickedAt: { not: null } },
    });

    const replied = await prisma.emailLog.count({
      where: { userId, repliedAt: { not: null } },
    });

    const bounced = await prisma.emailLog.count({
      where: { userId, status: 'BOUNCED' },
    });

    // Calculate rates
    const openRate = totalSent > 0 ? (opened / totalSent) * 100 : 0;
    const clickRate = totalSent > 0 ? (clicked / totalSent) * 100 : 0;
    const replyRate = totalSent > 0 ? (replied / totalSent) * 100 : 0;
    const bounceRate = totalSent > 0 ? (bounced / totalSent) * 100 : 0;

    // Emails by day (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const emailsByDay = await prisma.$queryRaw<Array<{ date: string; sent: number; opened: number; clicked: number }>>`
      SELECT 
        TO_CHAR(DATE_TRUNC('day', "sentAt"), 'YYYY-MM-DD') as date,
        COUNT(*)::int as sent,
        COUNT(CASE WHEN "openedAt" IS NOT NULL THEN 1 END)::int as opened,
        COUNT(CASE WHEN "clickedAt" IS NOT NULL THEN 1 END)::int as clicked
      FROM "EmailLog"
      WHERE "userId" = ${userId}
        AND "sentAt" >= ${thirtyDaysAgo}
        AND "sentAt" IS NOT NULL
      GROUP BY DATE_TRUNC('day', "sentAt")
      ORDER BY DATE_TRUNC('day', "sentAt") ASC
    `;

    // Sequence performance
    const sequenceStats = await prisma.sequenceEnrollment.groupBy({
      by: ['sequenceId'],
      where: {
        sequence: {
          userId: userId,
        },
      },
      _count: { _all: true },
    });

    const sequencePerformance = await Promise.all(
      sequenceStats.map(async (stat) => {
        const sequence = await prisma.emailSequence.findUnique({
          where: { id: stat.sequenceId },
          select: { name: true },
        });

        const completed = await prisma.sequenceEnrollment.count({
          where: { sequenceId: stat.sequenceId, status: 'COMPLETED' },
        });

        const active = await prisma.sequenceEnrollment.count({
          where: { sequenceId: stat.sequenceId, status: 'ACTIVE' },
        });

        return {
          sequenceId: stat.sequenceId,
          name: sequence?.name || 'Unknown',
          totalEnrollments: stat._count._all,
          active,
          completed,
          completionRate: stat._count._all > 0 ? (completed / stat._count._all) * 100 : 0,
        };
      })
    );

    return NextResponse.json({
      summary: {
        totalSent,
        opened,
        clicked,
        replied,
        bounced,
        openRate: Math.round(openRate * 10) / 10,
        clickRate: Math.round(clickRate * 10) / 10,
        replyRate: Math.round(replyRate * 10) / 10,
        bounceRate: Math.round(bounceRate * 10) / 10,
      },
      emailsByDay,
      sequencePerformance,
    });
  } catch (error) {
    console.error('Email analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch email analytics' },
      { status: 500 }
    );
  }
}
