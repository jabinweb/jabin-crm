import { NextResponse, after } from 'next/server';
import { hasLegacyRole } from '@/lib/auth/permissions';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';
import { getDataPrisma } from '@/lib/prisma-tenant';
import {
  milestoneTemplatesFor,
  PROJECT_INCLUDE,
  invalidProjectLink,
} from '@/lib/projects/agency-delivery';

export const GET = withTenantRoute(async (_request, { companyId }) => {
  const db = await getDataPrisma(companyId);
  const projects = await db.project.findMany({
    where: { companyId },
    include: {
      customer: { select: { id: true, organizationName: true } },
      deal: { select: { id: true, title: true } },
      pmUser: { select: { id: true, name: true } },
      _count: { select: { milestones: true, tickets: true, tasks: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });
  return jsonOk(projects);
});

export const POST = withTenantRoute(async (request, { session, companyId }) => {
  if (!hasLegacyRole(session, 'SUPER_ADMIN', 'ADMIN', 'SALES')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const db = await getDataPrisma(companyId);

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  const description = typeof body.description === 'string' ? body.description : '';
  const status = typeof body.status === 'string' ? body.status : 'ACTIVE';
  const projectType =
    typeof body.projectType === 'string' && body.projectType.trim()
      ? body.projectType.trim()
      : 'other';
  const start = body.startDate ? new Date(body.startDate) : new Date();
  const end = body.endDate
    ? new Date(body.endDate)
    : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return NextResponse.json({ error: 'Invalid dates' }, { status: 400 });
  }

  const customerId =
    typeof body.customerId === 'string' && body.customerId.trim()
      ? body.customerId.trim()
      : null;
  const dealId =
    typeof body.dealId === 'string' && body.dealId.trim() ? body.dealId.trim() : null;
  const pmUserId =
    typeof body.pmUserId === 'string' && body.pmUserId.trim()
      ? body.pmUserId.trim()
      : null;
  const withMilestones = body.withMilestones !== false;
  const linkError = await invalidProjectLink(db, companyId, { customerId, dealId, pmUserId });
  if (linkError) return NextResponse.json({ error: linkError }, { status: 400 });

  const project = await db.project.create({
    data: {
      name,
      description,
      status,
      projectType,
      startDate: start,
      endDate: end,
      companyId,
      customerId,
      dealId,
      pmUserId,
      ...(withMilestones && milestoneTemplatesFor(projectType).length > 0
        ? {
            milestones: {
              create: milestoneTemplatesFor(projectType).map((m) => ({
                title: m.title,
                sortOrder: m.sortOrder,
                status: 'PENDING',
              })),
            },
          }
        : {}),
    },
    include: PROJECT_INCLUDE,
  });

  if (pmUserId) {
    // The lead chosen at creation hears about it
    after(async () => {
      const { notifyProjectJoined } = await import('@/lib/projects/task-notifications');
      await notifyProjectJoined({
        companyId,
        projectId: project.id,
        actorId: session.user.id,
        actorName: session.user.name || session.user.email || 'Someone',
        userId: pmUserId,
        role: 'lead',
      });
    });
  }

  return jsonOk(project, { status: 201 });
});
