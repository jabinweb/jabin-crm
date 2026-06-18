import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { TenantError } from '@/lib/auth/company-membership';
import { ensureFeatureEnabled } from '@/lib/feature-modules';
import { resolveOptionalStaffCompanyScope } from '@/lib/tenant/scope-staff-query';

function hoursBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / (1000 * 60 * 60);
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await ensureFeatureEnabled(session.user.id, 'TICKETS');

    const companyId = await resolveOptionalStaffCompanyScope(session, req);
    if (!companyId && session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Company context required' }, { status: 400 });
    }

    const days = parseInt(req.nextUrl.searchParams.get('days') ?? '30', 10);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const ticketWhere = {
      createdAt: { gte: since },
      mergedIntoId: null,
      ...(companyId ? { customer: { companyId } } : {}),
    };

    const [
      totalTickets,
      openTickets,
      resolvedTickets,
      byChannel,
      byPriority,
      byStatus,
      csatAgg,
      slaTickets,
      recentVolume,
    ] = await Promise.all([
      prisma.supportTicket.count({ where: ticketWhere }),
      prisma.supportTicket.count({
        where: { ...ticketWhere, status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] } },
      }),
      prisma.supportTicket.count({
        where: { ...ticketWhere, status: { in: ['RESOLVED', 'CLOSED'] } },
      }),
      prisma.supportTicket.groupBy({
        by: ['channel'],
        where: ticketWhere,
        _count: true,
      }),
      prisma.supportTicket.groupBy({
        by: ['priority'],
        where: ticketWhere,
        _count: true,
      }),
      prisma.supportTicket.groupBy({
        by: ['status'],
        where: ticketWhere,
        _count: true,
      }),
      prisma.supportTicket.aggregate({
        where: { ...ticketWhere, csatRating: { not: null } },
        _avg: { csatRating: true },
        _count: { csatRating: true },
      }),
      prisma.supportTicket.findMany({
        where: {
          ...ticketWhere,
          responseDueAt: { not: null },
        },
        select: {
          id: true,
          status: true,
          createdAt: true,
          responseDueAt: true,
          resolutionDueAt: true,
          activities: {
            where: { eventType: { in: ['COMMENT', 'ASSIGNED', 'STATUS_CHANGED'] } },
            orderBy: { createdAt: 'asc' },
            take: 1,
            select: { createdAt: true },
          },
        },
        take: 500,
      }),
      prisma.supportTicket.findMany({
        where: ticketWhere,
        select: { createdAt: true, channel: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    let onTrack = 0;
    let atRisk = 0;
    let breached = 0;
    const now = new Date();

    for (const t of slaTickets) {
      const firstResponse = t.activities[0]?.createdAt ?? null;
      const due = t.responseDueAt!;
      if (t.status === 'RESOLVED' || t.status === 'CLOSED') {
        if (firstResponse && firstResponse <= due) onTrack++;
        else breached++;
        continue;
      }
      if (firstResponse && firstResponse <= due) {
        onTrack++;
      } else if (now > due) {
        breached++;
      } else if (hoursBetween(now, due) <= 2) {
        atRisk++;
      } else {
        onTrack++;
      }
    }

    const volumeByDay: Record<string, number> = {};
    for (const t of recentVolume) {
      const day = t.createdAt.toISOString().slice(0, 10);
      volumeByDay[day] = (volumeByDay[day] ?? 0) + 1;
    }

    const volumeTrend = Object.entries(volumeByDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));

    return NextResponse.json({
      periodDays: days,
      summary: {
        totalTickets,
        openTickets,
        resolvedTickets,
        resolutionRate: totalTickets > 0 ? Math.round((resolvedTickets / totalTickets) * 100) : 0,
        avgCsat: csatAgg._avg.csatRating
          ? Math.round(csatAgg._avg.csatRating * 10) / 10
          : null,
        csatResponses: csatAgg._count.csatRating,
      },
      sla: {
        onTrack,
        atRisk,
        breached,
        complianceRate:
          slaTickets.length > 0
            ? Math.round((onTrack / slaTickets.length) * 100)
            : 100,
      },
      byChannel: byChannel.map((c) => ({ channel: c.channel, count: c._count })),
      byPriority: byPriority.map((p) => ({ priority: p.priority, count: p._count })),
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count })),
      volumeTrend,
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[api/dashboard/support-stats]', error);
    return NextResponse.json({ error: 'Failed to load support stats' }, { status: 500 });
  }
}
