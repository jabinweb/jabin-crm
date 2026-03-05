import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get total customers count
    const totalCustomers = await prisma.customer.count({});

    // Get open tickets count
    const openTickets = await prisma.supportTicket.count({
      where: { status: 'OPEN' },
    });

    // Get equipment installations count
    const equipmentInstalled = await prisma.equipmentInstallation.count({});

    // Get total leads count
    const totalLeads = await prisma.lead.count({
      where: { userId: session.user.id },
    });

    // Get unique companies count
    const allLeads = await prisma.lead.findMany({
      where: {
        userId: session.user.id,
        companyName: { not: '' },
      },
      select: { companyName: true },
    });
    const uniqueCompanies = new Set(allLeads.map(l => l.companyName)).size;

    // Calculate weekly growth
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const leadsThisWeek = await prisma.lead.count({
      where: {
        userId: session.user.id,
        createdAt: { gte: weekAgo },
      },
    });

    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    const leadsLastWeek = await prisma.lead.count({
      where: {
        userId: session.user.id,
        createdAt: {
          gte: twoWeeksAgo,
          lt: weekAgo,
        },
      },
    });

    const weeklyGrowth = leadsLastWeek > 0
      ? ((leadsThisWeek - leadsLastWeek) / leadsLastWeek) * 100
      : 0;

    // Get duplicate leads count
    const { findAllDuplicates } = await import('@/lib/leads/duplicate-detector');
    const duplicateGroups = await findAllDuplicates(session.user.id, 0.9);
    const duplicateLeadsCount = duplicateGroups.reduce((sum, group) => sum + group.totalMatches, 0);

    return NextResponse.json({
      totalCustomers,
      openTickets,
      equipmentInstalled,
      totalLeads,
      totalCompanies: uniqueCompanies,
      weeklyGrowth: Math.round(weeklyGrowth * 10) / 10,
      duplicateLeadsCount,
      duplicateGroupsCount: duplicateGroups.length,
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard stats' },
      { status: 500 }
    );
  }
}
