import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hasLegacyRole } from '@/lib/auth/permissions';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';
import {
  PROJECT_PRIORITIES,
  computeProgressFromTasks,
} from '@/lib/projects/task-board';
import {
  isAllowedProjectTaskStatus,
  resolveDoneStatusIds,
} from '@/lib/projects/task-statuses';
import { logProjectTaskActivity } from '@/lib/projects/task-activity';

async function assertProject(companyId: string, projectId: string) {
  return prisma.project.findFirst({
    where: { id: projectId, companyId },
    select: { id: true },
  });
}

async function companySettings(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { settings: true },
  });
  return company?.settings;
}

async function syncProgress(projectId: string, companyId: string) {
  const [tasks, settings] = await Promise.all([
    prisma.projectTask.findMany({
      where: { projectId },
      select: { status: true },
    }),
    companySettings(companyId),
  ]);
  const progress = computeProgressFromTasks(
    tasks,
    resolveDoneStatusIds(settings)
  );
  await prisma.project.update({ where: { id: projectId }, data: { progress } });
  return progress;
}

export const GET = withTenantRoute(async (request, { companyId }, routeContext) => {
  const projectId = (await routeContext!.params).id;
  const project = await assertProject(companyId, projectId);
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const url = new URL(request.url);
  /** Board shows top-level only; pass ?all=1 to include subtasks */
  const includeSubtasks = url.searchParams.get('all') === '1';

  const tasks = await prisma.projectTask.findMany({
    where: {
      projectId,
      ...(includeSubtasks ? {} : { parentTaskId: null }),
    },
    include: {
      assignee: { select: { id: true, name: true, email: true, image: true } },
      _count: { select: { subtasks: true } },
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

  const settings = await companySettings(companyId);
  const status =
    typeof body.status === 'string' && isAllowedProjectTaskStatus(body.status, settings)
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

  let parentTaskId: string | null = null;
  if (typeof body.parentTaskId === 'string' && body.parentTaskId.trim()) {
    const parent = await prisma.projectTask.findFirst({
      where: { id: body.parentTaskId.trim(), projectId },
      select: { id: true, parentTaskId: true, title: true },
    });
    if (!parent) {
      return NextResponse.json({ error: 'Parent task not found' }, { status: 400 });
    }
    // One level only (no nested subtasks)
    if (parent.parentTaskId) {
      return NextResponse.json(
        { error: 'Cannot add subtasks to a subtask' },
        { status: 400 }
      );
    }
    parentTaskId = parent.id;
  }

  const descriptionHtml =
    typeof body.descriptionHtml === 'string' ? body.descriptionHtml : null;
  const description =
    typeof body.description === 'string'
      ? body.description
      : descriptionHtml
        ? descriptionHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160)
        : null;

  const task = await prisma.projectTask.create({
    data: {
      projectId,
      parentTaskId,
      title,
      description,
      descriptionHtml,
      status,
      priority,
      reporterId: session.user.id,
      assigneeId:
        typeof body.assigneeId === 'string' && body.assigneeId.trim()
          ? body.assigneeId.trim()
          : null,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      sortOrder: (max._max.sortOrder ?? -1) + 1,
    },
    include: {
      assignee: { select: { id: true, name: true, email: true, image: true } },
      reporter: { select: { id: true, name: true, email: true, image: true } },
    },
  });

  const actorName = session.user.name || session.user.email || 'User';
  await logProjectTaskActivity({
    taskId: task.id,
    actorId: session.user.id,
    eventType: 'CREATED',
    description: parentTaskId
      ? `${actorName} created subtask`
      : `${actorName} created this task`,
  });

  if (parentTaskId) {
    await logProjectTaskActivity({
      taskId: parentTaskId,
      actorId: session.user.id,
      eventType: 'SUBTASK_ADDED',
      description: `${actorName} added subtask “${task.title}”`,
      metadata: { subtaskId: task.id },
    });
  }

  await prisma.projectTaskWatcher.upsert({
    where: { taskId_userId: { taskId: task.id, userId: session.user.id } },
    create: { taskId: task.id, userId: session.user.id },
    update: {},
  });

  const progress = await syncProgress(projectId, companyId);
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
  const settings = await companySettings(companyId);

  /** Bulk reorder after drag: { moves: [{ id, status, sortOrder }] } */
  if (Array.isArray(body.moves)) {
    const moves = body.moves as Array<{ id: string; status: string; sortOrder: number }>;
    await prisma.$transaction(
      moves.map((m) =>
        prisma.projectTask.updateMany({
          where: { id: m.id, projectId },
          data: {
            ...(isAllowedProjectTaskStatus(m.status, settings)
              ? { status: m.status }
              : {}),
            sortOrder: m.sortOrder,
          },
        })
      )
    );
    const progress = await syncProgress(projectId, companyId);
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
  if (typeof body.descriptionHtml === 'string') {
    data.descriptionHtml = body.descriptionHtml;
    if (typeof body.description !== 'string') {
      data.description = body.descriptionHtml
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 160);
    }
  }
  if (typeof body.status === 'string' && isAllowedProjectTaskStatus(body.status, settings)) {
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
  const progress = await syncProgress(projectId, companyId);
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
  const progress = await syncProgress(projectId, companyId);
  return jsonOk({ ok: true, progress });
});
