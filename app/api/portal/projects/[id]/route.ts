import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { resolvePortalDataAccess } from '@/lib/api/portal-access';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const access = resolvePortalDataAccess(session);
    if (!access.ok) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (access.scope === 'staff') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const { id } = await context.params;
    const project = await prisma.project.findFirst({
      where: {
        id,
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
        milestones: {
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            title: true,
            status: true,
            dueDate: true,
            sortOrder: true,
            completedAt: true,
          },
        },
        tasks: {
          where: {
            parentTaskId: null,
            status: { notIn: ['BACKLOG', 'CANCELLED'] },
          },
          orderBy: [{ status: 'asc' }, { sortOrder: 'asc' }],
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            dueDate: true,
            comments: {
              orderBy: { createdAt: 'desc' },
              take: 5,
              select: {
                id: true,
                body: true,
                createdAt: true,
                author: { select: { name: true } },
              },
            },
            attachments: {
              where: { source: { in: ['SIDEBAR', 'DESCRIPTION'] } },
              orderBy: { createdAt: 'desc' },
              take: 8,
              select: {
                id: true,
                url: true,
                name: true,
                mimeType: true,
                createdAt: true,
              },
            },
          },
          take: 40,
        },
        retainers: {
          where: { status: 'ACTIVE' },
          select: {
            id: true,
            name: true,
            amount: true,
            currency: true,
            billingCycle: true,
            nextBillAt: true,
          },
          take: 5,
        },
        tickets: {
          select: {
            id: true,
            subject: true,
            status: true,
            priority: true,
            createdAt: true,
          },
          orderBy: { updatedAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(project);
  } catch (error) {
    console.error('Error fetching portal project:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
