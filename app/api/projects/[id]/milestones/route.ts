import { NextResponse, after } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hasLegacyRole } from '@/lib/auth/permissions';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';
import { syncProjectProgress } from '@/lib/projects/sync-project-progress';

function notifyMilestone(
  session: { user: { id: string; name?: string | null; email?: string | null } },
  companyId: string,
  projectId: string,
  change: { title: string; action: 'added' | 'removed' | 'status'; status?: string; previousStatus?: string }
) {
  after(async () => {
    const { notifyMilestoneChange } = await import('@/lib/projects/task-notifications');
    await notifyMilestoneChange({
      companyId,
      projectId,
      actorId: session.user.id,
      actorName: session.user.name || session.user.email || 'Someone',
      ...change,
    });
  });
}

async function assertProject(companyId: string, projectId: string) {
  return prisma.project.findFirst({
    where: { id: projectId, companyId },
    select: { id: true },
  });
}

// Same rule as task changes: tasks drive progress, milestones only when there are no tasks
const refreshProgress = (projectId: string, companyId: string) =>
  syncProjectProgress(projectId, companyId);

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
  await refreshProgress(projectId, companyId);
  notifyMilestone(session, companyId, projectId, { title: milestone.title, action: 'added' });
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
  const progress = await refreshProgress(projectId, companyId);
  if (typeof body.status === 'string' && body.status !== existing.status) {
    notifyMilestone(session, companyId, projectId, {
      title: milestone.title,
      action: 'status',
      status: body.status,
      previousStatus: existing.status,
    });
  }
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

  const toDelete = await prisma.projectMilestone.findFirst({
    where: { id: milestoneId, projectId },
    select: { title: true },
  });
  const deleted = await prisma.projectMilestone.deleteMany({
    where: { id: milestoneId, projectId },
  });
  if (!deleted.count) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const progress = await refreshProgress(projectId, companyId);
  if (toDelete) notifyMilestone(session, companyId, projectId, { title: toDelete.title, action: 'removed' });
  return jsonOk({ ok: true, progress });
});
