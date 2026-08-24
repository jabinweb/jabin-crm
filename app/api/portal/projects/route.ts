import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { resolvePortalDataAccess } from '@/lib/api/portal-access';

export async function GET() {
  try {
    const session = await auth();
    const access = resolvePortalDataAccess(session);

    if (!access.ok) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (access.scope === 'staff') {
      return NextResponse.json([]);
    }

    const projects = await prisma.project.findMany({
      where: {
        customerId: access.customerId,
        status: { not: 'CANCELLED' },
      },
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        projectType: true,
        progress: true,
        startDate: true,
        endDate: true,
        updatedAt: true,
        milestones: {
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            title: true,
            status: true,
            dueDate: true,
            sortOrder: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json(projects);
  } catch (error) {
    console.error('Error fetching portal projects:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
