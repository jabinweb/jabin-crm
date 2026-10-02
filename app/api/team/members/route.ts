import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { resolveCompanyContextFromRequest } from '@/lib/auth/company-membership';
import { handleRouteError } from '@/lib/api/tenant-response';
import type { Prisma } from '@prisma/client';

// Get team members
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

    // Get all users for team collaboration
    const teamMembers = await prisma.user.findMany({
      where: memberWhere,
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        _count: {
          select: {
            assignedLeads: true,
            assignedDeals: true,
            assignedTasks: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    return NextResponse.json(teamMembers);
  } catch (error) {
    console.error('Team members fetch error:', error);
    return handleRouteError(error);
  }
}
