import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hasLegacyRole } from '@/lib/auth/permissions';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';
import { computeProgressFromMilestones } from '@/lib/projects/agency-delivery';

async function assertProject(companyId: string, projectId: string) {
  return prisma.project.findFirst({
    where: { id: projectId, companyId },
    select: { id: true },
  });
}

async function refreshProgress(projectId: string) {
  const milestones = await prisma.projectMilestone.findMany({
    where: { projectId },
    select: { status: true },
  });
  const progress = computeProgressFromMilestones(milestones);
  await prisma.project.update({ where: { id: projectId }, data: { progress } });
  return progress;
}

export const GET = withTenantRoute(async (_request, { companyId }, routeContext) => {
  const projectId = (await routeContext!.params).id;
  const project = await assertProject(companyId, projectId);
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const milestones = await prisma.projectMilestone.findMany({
    where: { projectId },
    orderBy: { sortOrder: 'asc' },
  });
  return jsonOk(milestones);
});

export const POST = withTenantRoute(async (request, { session, companyId }, routeContext) => {
  if (!hasLegacyRole(session, 'SUPER_ADMIN', 'ADMIN', 'SALES')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const projectId = (await routeContext!.params).id;
  const project = await assertProject(companyId, projectId);
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json();
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title) return NextResponse.json({ error: 'Title required' }, { status: 400 });

  const max = await prisma.projectMilestone.aggregate({
    where: { projectId },
    _max: { sortOrder: true },
  });

  const milestone = await prisma.projectMilestone.create({
    data: {
      projectId,
      title,
      description: typeof body.description === 'string' ? body.description : null,
      status: typeof body.status === 'string' ? body.status : 'PENDING',
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      sortOrder:
        typeof body.sortOrder === 'number'
          ? body.sortOrder
          : (max._max.sortOrder ?? -1) + 1,
    },
  });
  await refreshProgress(projectId);
  return jsonOk(milestone, { status: 201 });
});

export const PATCH = withTenantRoute(async (request, { session, companyId }, routeContext) => {
  if (!hasLegacyRole(session, 'SUPER_ADMIN', 'ADMIN', 'SALES')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const projectId = (await routeContext!.params).id;
  const project = await assertProject(companyId, projectId);
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json();
  const milestoneId = typeof body.id === 'string' ? body.id : '';
  if (!milestoneId) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const existing = await prisma.projectMilestone.findFirst({
    where: { id: milestoneId, projectId },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (typeof body.title === 'string') data.title = body.title.trim();
  if (typeof body.description === 'string') data.description = body.description;
  if (typeof body.status === 'string') {
    data.status = body.status;
    data.completedAt = body.status === 'DONE' ? new Date() : null;
  }
  if (body.dueDate !== undefined) {
    data.dueDate = body.dueDate ? new Date(body.dueDate) : null;
  }
  if (typeof body.sortOrder === 'number') data.sortOrder = body.sortOrder;

  const milestone = await prisma.projectMilestone.update({
    where: { id: milestoneId },
    data,
  });
  const progress = await refreshProgress(projectId);
  return jsonOk({ milestone, progress });
});

export const DELETE = withTenantRoute(async (request, { session, companyId }, routeContext) => {
  if (!hasLegacyRole(session, 'SUPER_ADMIN', 'ADMIN', 'SALES')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const projectId = (await routeContext!.params).id;
  const project = await assertProject(companyId, projectId);
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const url = new URL(request.url);
  const milestoneId = url.searchParams.get('milestoneId');
  if (!milestoneId) {
    return NextResponse.json({ error: 'milestoneId required' }, { status: 400 });
  }

  const deleted = await prisma.projectMilestone.deleteMany({
    where: { id: milestoneId, projectId },
  });
  if (!deleted.count) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const progress = await refreshProgress(projectId);
  return jsonOk({ ok: true, progress });
});
