import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { LeadStatus, CampaignStatus } from '@prisma/client';
import {
  endOfMonth,
  endOfWeek,
  startOfMonth,
  startOfWeek,
  subDays,
} from 'date-fns';

type DateRange = '7d' | '30d' | 'week' | 'month' | 'all';

function resolveRange(range: DateRange): { start: Date; end: Date; prevStart: Date; prevEnd: Date } {
  const end = new Date();
  if (range === '7d') {
    const start = subDays(end, 7);
    return { start, end, prevStart: subDays(start, 7), prevEnd: start };
  }
  if (range === '30d') {
    const start = subDays(end, 30);
    return { start, end, prevStart: subDays(start, 30), prevEnd: start };
  }
  if (range === 'week') {
    const start = startOfWeek(end);
    const prevEnd = start;
    return { start, end: endOfWeek(end), prevStart: subDays(start, 7), prevEnd };
  }
  if (range === 'month') {
    const start = startOfMonth(end);
    const prevEnd = start;
    return { start, end: endOfMonth(end), prevStart: startOfMonth(subDays(start, 1)), prevEnd };
  }
  const start = new Date(0);
  return { start, end, prevStart: new Date(0), prevEnd: start };
}

function growthPercent(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const range = (req.nextUrl.searchParams.get('range') || '30d') as DateRange;
    const { start, end, prevStart, prevEnd } = resolveRange(range);
    const userId = session.user.id;

    const leadWhere = (from: Date, to: Date) => ({
      userId,
      createdAt: { gte: from, lte: to },
    });

    const [
      totalLeads,
      prevLeads,
      newLeads,
      contactedLeads,
      convertedLeads,
      statusGroups,
      emailsSent,
      emailsOpened,
      emailsClicked,
      campaignsTotal,
      campaignsActive,
      campaignList,
      sourceGroups,
      industryGroups,
      recentLeadActivities,
    ] = await Promise.all([
      prisma.lead.count({ where: leadWhere(start, end) }),
      prisma.lead.count({ where: leadWhere(prevStart, prevEnd) }),
      prisma.lead.count({ where: leadWhere(start, end) }),
      prisma.lead.count({
        where: {
          userId,
          status: { not: LeadStatus.NEW },
          updatedAt: { gte: start, lte: end },
        },
      }),
      prisma.lead.count({
        where: {
          userId,
          status: { in: [LeadStatus.WON, LeadStatus.CONVERTED] },
          updatedAt: { gte: start, lte: end },
        },
      }),
      prisma.lead.groupBy({
        by: ['status'],
        where: { userId, createdAt: { gte: start, lte: end } },
        _count: true,
      }),
      prisma.emailLog.count({
        where: { userId, sentAt: { gte: start, lte: end } },
      }),
      prisma.emailLog.count({
        where: { userId, openedAt: { gte: start, lte: end } },
      }),
      prisma.emailLog.count({
        where: { userId, clickedAt: { gte: start, lte: end } },
      }),
      prisma.emailCampaign.count({ where: { userId } }),
      prisma.emailCampaign.count({
        where: { userId, status: { in: [CampaignStatus.SENDING, CampaignStatus.SCHEDULED] } },
      }),
      prisma.emailCampaign.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, name: true, status: true, createdAt: true },
      }),
      prisma.lead.groupBy({
        by: ['source'],
        where: { userId, createdAt: { gte: start, lte: end } },
        _count: true,
        orderBy: { _count: { source: 'desc' } },
        take: 8,
      }),
      prisma.lead.groupBy({
        by: ['industry'],
        where: { userId, industry: { not: null }, createdAt: { gte: start, lte: end } },
        _count: true,
        orderBy: { _count: { industry: 'desc' } },
        take: 8,
      }),
      prisma.leadActivity.findMany({
        where: { lead: { userId } },
        orderBy: { createdAt: 'desc' },
        take: 12,
        include: { lead: { select: { companyName: true } } },
      }),
    ]);

    const openRate = emailsSent ? Math.round((emailsOpened / emailsSent) * 1000) / 10 : 0;
    const clickRate = emailsSent ? Math.round((emailsClicked / emailsSent) * 1000) / 10 : 0;
    const contactRate = totalLeads ? Math.round((contactedLeads / totalLeads) * 1000) / 10 : 0;
    const conversionRate = totalLeads ? Math.round((convertedLeads / totalLeads) * 1000) / 10 : 0;

    return NextResponse.json({
      leads: {
        total: totalLeads,
        growth: growthPercent(totalLeads, prevLeads),
        new: newLeads,
        contacted: contactedLeads,
        converted: convertedLeads,
        contactRate,
        conversionRate,
        byStatus: statusGroups.map((row) => ({
          status: row.status,
          count: row._count,
        })),
      },
      emails: {
        sent: emailsSent,
        opened: emailsOpened,
        clicked: emailsClicked,
        openRate,
        clickRate,
      },
      campaigns: {
        total: campaignsTotal,
        active: campaignsActive,
        list: campaignList,
      },
      performance: {
        conversionRate,
        conversions: convertedLeads,
        avgResponseTime: 'N/A',
        qualityScore: 0,
        roi: 0,
        costPerLead: 0,
      },
      topSources: sourceGroups.map((row) => ({
        source: row.source,
        count: row._count,
      })),
      topIndustries: industryGroups
        .filter((row) => row.industry)
        .map((row) => ({
          industry: row.industry,
          count: row._count,
        })),
      recentActivities: recentLeadActivities.map((a) => ({
        id: a.id,
        type: a.activityType,
        description: a.description,
        createdAt: a.createdAt,
        lead: a.lead,
      })),
    });
  } catch (error) {
    console.error('[api/dashboard/reports]', error);
    return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 });
  }
}
