import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { resolveCompanyContextFromRequest } from '@/lib/auth/company-membership';
import { handleRouteError } from '@/lib/api/tenant-response';
import type { Prisma } from '@prisma/client';

/**
 * Team performance analytics (sales-focused).
 * `assignedTasks` / `completedTasks` count CRM follow-up Tasks only — not ProjectTasks.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only users of the request workspace (never every user on the platform)
    const { companyId } = await resolveCompanyContextFromRequest(session, request);
    const memberWhere: Prisma.UserWhereInput = {
      OR: [
        { userCompanies: { some: { companyId } } },
        { primaryCompanyId: companyId },
        { companyId },
      ],
    };

    // Get team members with their performance stats
    const teamMembers = await prisma.user.findMany({
      where: memberWhere,
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
      },
    });

    const performance = await Promise.all(
      teamMembers.map(async (member) => {
        const [
          assignedLeadsCount,
          assignedDealsCount,
          assignedTasksCount,
          completedTasksCount,
          wonDealsCount,
          wonDealsValue,
        ] = await Promise.all([
          prisma.lead.count({
            where: { assignedToId: member.id, companyId },
          }),
          prisma.deal.count({
            where: { assignedToId: member.id },
          }),
          // Sales follow-up tasks (Task model), not delivery ProjectTasks
          prisma.task.count({
            where: { assignedToId: member.id },
          }),
          prisma.task.count({
            where: {
              assignedToId: member.id,
              status: 'COMPLETED',
            },
          }),
          prisma.deal.count({
            where: {
              assignedToId: member.id,
              stage: 'CLOSED_WON',
            },
          }),
          prisma.deal.aggregate({
            where: {
              assignedToId: member.id,
              stage: 'CLOSED_WON',
            },
            _sum: {
              value: true,
            },
          }),
        ]);

        return {
          ...member,
          stats: {
            assignedLeads: assignedLeadsCount,
            assignedDeals: assignedDealsCount,
            /** CRM sales follow-ups (Task), not project delivery tasks */
            assignedTasks: assignedTasksCount,
            completedTasks: completedTasksCount,
            wonDeals: wonDealsCount,
            wonRevenue: wonDealsValue._sum.value || 0,
            taskCompletionRate:
              assignedTasksCount > 0
                ? (completedTasksCount / assignedTasksCount) * 100
                : 0,
          },
        };
      })
    );

    // Sort by won revenue
    performance.sort((a, b) => b.stats.wonRevenue - a.stats.wonRevenue);

    return NextResponse.json(performance);
  } catch (error) {
    console.error('Team performance fetch error:', error);
    return handleRouteError(error);
  }
}
