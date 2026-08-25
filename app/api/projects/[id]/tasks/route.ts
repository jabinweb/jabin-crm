import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hasLegacyRole } from '@/lib/auth/permissions';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';
import {
  PROJECT_TASK_STATUSES,
  PROJECT_PRIORITIES,
  computeProgressFromTasks,
} from '@/lib/projects/task-board';

async function assertProject(companyId: string, projectId: string) {
  return prisma.project.findFirst({
    where: { id: projectId, companyId },
    select: { id: true },
  });
}

async function syncProgress(projectId: string) {
  const tasks = await prisma.projectTask.findMany({
    where: { projectId },
    select: { status: true },
  });
  const progress = computeProgressFromTasks(tasks);
  await prisma.project.update({ where: { id: projectId }, data: { progress } });
  return progress;
}

export const GET = withTenantRoute(async (_request, { companyId }, routeContext) => {
  const projectId = (await routeContext!.params).id;
  const project = await assertProject(companyId, projectId);
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const tasks = await prisma.projectTask.findMany({
    where: { projectId },
    include: {
      assignee: { select: { id: true, name: true, email: true, image: true } },
    },
    orderBy: [{ status: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  return jsonOk(tasks);
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

  const status =
    typeof body.status === 'string' && PROJECT_TASK_STATUSES.includes(body.status)
      ? body.status
      : 'TODO';
  const priority =
    typeof body.priority === 'string' &&
    (PROJECT_PRIORITIES as readonly string[]).includes(body.priority)
      ? body.priority
      : 'MEDIUM';

  const max = await prisma.projectTask.aggregate({
    where: { projectId, status },
    _max: { sortOrder: true },
  });

  const task = await prisma.projectTask.create({
    data: {
      projectId,
      title,
      description: typeof body.description === 'string' ? body.description : null,
      status,
      priority,
      assigneeId:
        typeof body.assigneeId === 'string' && body.assigneeId.trim()
          ? body.assigneeId.trim()
          : null,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      sortOrder: (max._max.sortOrder ?? -1) + 1,
    },
    include: {
      assignee: { select: { id: true, name: true, email: true, image: true } },
    },
  });

  const progress = await syncProgress(projectId);
  return jsonOk({ task, progress }, { status: 201 });
});

export const PATCH = withTenantRoute(async (request, { session, companyId }, routeContext) => {
  if (!hasLegacyRole(session, 'SUPER_ADMIN', 'ADMIN', 'SALES')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const projectId = (await routeContext!.params).id;
  const project = await assertProject(companyId, projectId);
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json();

  /** Bulk reorder after drag: { moves: [{ id, status, sortOrder }] } */
  if (Array.isArray(body.moves)) {
    const moves = body.moves as Array<{ id: string; status: string; sortOrder: number }>;
    await prisma.$transaction(
      moves.map((m) =>
        prisma.projectTask.updateMany({
          where: { id: m.id, projectId },
          data: {
            ...(PROJECT_TASK_STATUSES.includes(m.status)
              ? { status: m.status }
              : {}),
            sortOrder: m.sortOrder,
          },
        })
      )
    );
    const progress = await syncProgress(projectId);
    const tasks = await prisma.projectTask.findMany({
      where: { projectId },
      include: {
        assignee: { select: { id: true, name: true, email: true, image: true } },
      },
      orderBy: [{ status: 'asc' }, { sortOrder: 'asc' }],
    });
    return jsonOk({ tasks, progress });
  }

  const taskId = typeof body.id === 'string' ? body.id : '';
  if (!taskId) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const existing = await prisma.projectTask.findFirst({
    where: { id: taskId, projectId },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (typeof body.title === 'string') data.title = body.title.trim();
  if (typeof body.description === 'string') data.description = body.description;
  if (typeof body.status === 'string' && PROJECT_TASK_STATUSES.includes(body.status)) {
    data.status = body.status;
  }
  if (
    typeof body.priority === 'string' &&
    (PROJECT_PRIORITIES as readonly string[]).includes(body.priority)
  ) {
    data.priority = body.priority;
  }
  if (body.assigneeId !== undefined) {
    data.assigneeId =
      typeof body.assigneeId === 'string' && body.assigneeId.trim()
        ? body.assigneeId.trim()
        : null;
  }
  if (body.dueDate !== undefined) {
    data.dueDate = body.dueDate ? new Date(body.dueDate) : null;
  }
  if (typeof body.sortOrder === 'number') data.sortOrder = body.sortOrder;

  const task = await prisma.projectTask.update({
    where: { id: taskId },
    data,
    include: {
      assignee: { select: { id: true, name: true, email: true, image: true } },
    },
  });
  const progress = await syncProgress(projectId);
  return jsonOk({ task, progress });
});

export const DELETE = withTenantRoute(async (request, { session, companyId }, routeContext) => {
  if (!hasLegacyRole(session, 'SUPER_ADMIN', 'ADMIN', 'SALES')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const projectId = (await routeContext!.params).id;
  const project = await assertProject(companyId, projectId);
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const url = new URL(request.url);
  const taskId = url.searchParams.get('taskId');
  if (!taskId) {
    return NextResponse.json({ error: 'taskId required' }, { status: 400 });
  }

  const deleted = await prisma.projectTask.deleteMany({
    where: { id: taskId, projectId },
  });
  if (!deleted.count) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const progress = await syncProgress(projectId);
  return jsonOk({ ok: true, progress });
});
