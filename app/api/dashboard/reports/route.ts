import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || '30d';

    // Calculate date range
    let startDate: Date;
    let previousStartDate: Date;
    const now = new Date();

    switch (range) {
      case '7d':
        startDate = subDays(now, 7);
        previousStartDate = subDays(now, 14);
        break;
      case '30d':
        startDate = subDays(now, 30);
        previousStartDate = subDays(now, 60);
        break;
      case 'week':
        startDate = startOfWeek(now);
        previousStartDate = startOfWeek(subDays(now, 7));
        break;
      case 'month':
        startDate = startOfMonth(now);
        previousStartDate = startOfMonth(subDays(now, 30));
        break;
      case 'all':
        startDate = new Date(0);
        previousStartDate = new Date(0);
        break;
      default:
        startDate = subDays(now, 30);
        previousStartDate = subDays(now, 60);
    }

    // Fetch leads data
    const totalLeads = await prisma.lead.count({
      where: {
        userId: session.user.id,
        createdAt: { gte: startDate },
      },
    });

    const previousLeads = await prisma.lead.count({
      where: {
        userId: session.user.id,
        createdAt: {
          gte: previousStartDate,
          lt: startDate,
        },
      },
    });

    const leadsGrowth = previousLeads > 0
      ? Math.round(((totalLeads - previousLeads) / previousLeads) * 100)
      : 0;

    // Lead status breakdown
    const leadsByStatus = await prisma.lead.groupBy({
      by: ['status'],
      where: {
        userId: session.user.id,
        createdAt: { gte: startDate },
      },
      _count: true,
    });

    const leadStatusBreakdown = leadsByStatus.map(item => ({
      status: item.status,
      count: item._count,
      percentage: totalLeads > 0 ? Math.round((item._count / totalLeads) * 100) : 0,
    }));

    // Leads by specific statuses
    const newLeads = leadsByStatus.find(s => s.status === 'NEW')?._count || 0;
    const contactedLeads = leadsByStatus.find(s => s.status === 'CONTACTED')?._count || 0;
    const convertedLeads = leadsByStatus.find(s => s.status === 'CONVERTED')?._count || 0;

    // Top sources
    const leadsBySource = await prisma.lead.groupBy({
      by: ['source'],
      where: {
        userId: session.user.id,
        createdAt: { gte: startDate },
      },
      _count: true,
      orderBy: {
        _count: {
          source: 'desc',
        },
      },
      take: 5,
    });

    const topSources = leadsBySource.map(item => ({
      name: item.source,
      count: item._count,
      percentage: totalLeads > 0 ? Math.round((item._count / totalLeads) * 100) : 0,
    }));

    // Top industries
    const leadsByIndustry = await prisma.lead.groupBy({
      by: ['industry'],
      where: {
        userId: session.user.id,
        createdAt: { gte: startDate },
        industry: { not: null },
      },
      _count: true,
      orderBy: {
        _count: {
          industry: 'desc',
        },
      },
      take: 5,
    });

    const topIndustries = leadsByIndustry.map(item => ({
      name: item.industry,
      count: item._count,
      percentage: totalLeads > 0 ? Math.round((item._count / totalLeads) * 100) : 0,
    }));

    // Email campaigns data
    const campaigns = await prisma.emailCampaign.findMany({
      where: {
        userId: session.user.id,
        createdAt: { gte: startDate },
      },
      select: {
        id: true,
        name: true,
        status: true,
        sentCount: true,
        openCount: true,
        clickCount: true,
        replyCount: true,
      },
    });

    const activeCampaigns = campaigns.filter(c =>
      c.status === 'SCHEDULED' || c.status === 'SENDING'
    ).length;

    const totalEmailsSent = campaigns.reduce((sum, c) => sum + c.sentCount, 0);
    const totalOpened = campaigns.reduce((sum, c) => sum + c.openCount, 0);
    const totalClicked = campaigns.reduce((sum, c) => sum + c.clickCount, 0);
    const totalReplied = campaigns.reduce((sum, c) => sum + c.replyCount, 0);

    const openRate = totalEmailsSent > 0
      ? Math.round((totalOpened / totalEmailsSent) * 100)
      : 0;

    const clickRate = totalEmailsSent > 0
      ? Math.round((totalClicked / totalEmailsSent) * 100)
      : 0;

    const campaignList = campaigns.map(c => ({
      name: c.name,
      status: c.status,
      sent: c.sentCount,
      opened: c.openCount,
      clicked: c.clickCount,
      replied: c.replyCount,
    }));



    // Recent activities
    const recentActivities = await prisma.leadActivity.findMany({
      where: {
        userId: session.user.id,
        createdAt: { gte: startDate },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        activityType: true,
        description: true,
        createdAt: true,
      },
    });

    const activities = recentActivities.map(a => ({
      type: a.activityType.includes('EMAIL') ? 'email' :
        a.activityType.includes('CREATED') ? 'lead' : 'campaign',
      description: a.description,
      createdAt: a.createdAt,
      status: 'success',
    }));

    // Performance metrics
    const conversionRate = totalLeads > 0
      ? Math.round((convertedLeads / totalLeads) * 100)
      : 0;

    return NextResponse.json({
      leads: {
        total: totalLeads,
        growth: leadsGrowth,
        new: newLeads,
        contacted: contactedLeads,
        converted: convertedLeads,
        contactRate: totalLeads > 0 ? Math.round((contactedLeads / totalLeads) * 100) : 0,
        conversionRate,
        byStatus: leadStatusBreakdown,
      },
      emails: {
        sent: totalEmailsSent,
        opened: totalOpened,
        clicked: totalClicked,
        replied: totalReplied,
        openRate,
        clickRate,
      },
      campaigns: {
        total: campaigns.length,
        active: activeCampaigns,
        list: campaignList,
      },
      performance: {
        conversionRate,
        conversions: convertedLeads,
        avgResponseTime: 'N/A', // TODO: Calculate from email events
        qualityScore: 0, // TODO: Implement quality scoring
        roi: 0, // TODO: Calculate ROI
        costPerLead: 0, // TODO: Calculate cost per lead
      },
      topSources,
      topIndustries,
      recentActivities: activities,
    });

  } catch (error: any) {
    console.error('Error fetching reports:', error);
    return NextResponse.json({
      error: 'Failed to fetch reports',
      details: error.message
    }, { status: 500 });
  }
}
