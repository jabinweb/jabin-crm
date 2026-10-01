import { NextResponse, after } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';
import { canWriteProjectDelivery } from '@/lib/projects/task-access';
import { PROJECT_PRIORITIES } from '@/lib/projects/task-board';
import { isAllowedProjectTaskStatus } from '@/lib/projects/task-statuses';
import { logProjectTaskActivity } from '@/lib/projects/task-activity';
import {
  getCompanyProjectTaskSettings,
  syncProjectProgress,
} from '@/lib/projects/sync-project-progress';
import { PROJECT_TASK_LIST_INCLUDE } from '@/lib/projects/agency-delivery';
import { updateProjectTask } from '@/lib/projects/update-task';
import { sanitizeRichText } from '@/lib/html/sanitize-rich-text';
import { extractMentionIds, isCompanyStaff } from '@/lib/projects/mentions';

async function assertProject(companyId: string, projectId: string) {
  return prisma.project.findFirst({
    where: { id: projectId, companyId },
    select: { id: true },
  });
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
    include: PROJECT_TASK_LIST_INCLUDE,
    orderBy: [{ status: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  return jsonOk(tasks);
});

export const POST = withTenantRoute(async (request, { session, companyId }, routeContext) => {
  const projectId = (await routeContext!.params).id;
  if (!(await canWriteProjectDelivery(session, companyId, projectId))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const project = await assertProject(companyId, projectId);
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json();
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title) return NextResponse.json({ error: 'Title required' }, { status: 400 });

  const settings = await getCompanyProjectTaskSettings(companyId);
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
    typeof body.descriptionHtml === 'string'
      ? sanitizeRichText(body.descriptionHtml)
      : null;

  const assigneeId =
    typeof body.assigneeId === 'string' && body.assigneeId.trim()
      ? body.assigneeId.trim()
      : null;
  if (assigneeId && !(await isCompanyStaff(companyId, assigneeId))) {
    return NextResponse.json(
      { error: 'Assignee must be a member of this workspace' },
      { status: 400 }
    );
  }

  const dueDate = body.dueDate ? new Date(body.dueDate) : null;
  if (dueDate && Number.isNaN(dueDate.getTime())) {
    return NextResponse.json({ error: 'Invalid due date' }, { status: 400 });
  }
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
      assigneeId,
      dueDate,
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

  const progress = await syncProjectProgress(projectId, companyId);

  const mentionedIds = extractMentionIds(descriptionHtml);
  after(async () => {
    const notifications = await import('@/lib/projects/task-notifications');
    if (task.assigneeId) {
      await notifications.notifyProjectTaskAssigned({
        companyId,
        projectId,
        taskId: task.id,
        taskTitle: task.title,
        actorId: session.user.id,
        actorName,
        assigneeId: task.assigneeId,
      });
    }
    if (mentionedIds.length > 0) {
      await notifications.notifyProjectMentions({
        companyId,
        projectId,
        actorId: session.user.id,
        actorName,
        mentionedIds,
        target: { kind: 'task-description', taskId: task.id, title: task.title },
      });
    }

    const { dispatchWorkflowEvent } = await import('@/lib/workflows/executor');
    await dispatchWorkflowEvent('project.task.created', {
      userId: session.user.id,
      companyId,
      title: task.title,
      summary: `${actorName} created “${task.title}”`,
      metadata: { projectId, taskId: task.id, status: task.status, priority: task.priority },
    });
  });

  return jsonOk({ task, progress }, { status: 201 });
});

export const PATCH = withTenantRoute(async (request, { session, companyId }, routeContext) => {
  const projectId = (await routeContext!.params).id;
  if (!(await canWriteProjectDelivery(session, companyId, projectId))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const project = await assertProject(companyId, projectId);
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json();
  const settings = await getCompanyProjectTaskSettings(companyId);

  /** Bulk reorder after drag: { moves: [{ id, status, sortOrder }] } */
  if (Array.isArray(body.moves)) {
    const moves = (body.moves as Array<{ id: string; status: string; sortOrder: number }>).filter(
      (m) => m && typeof m.id === 'string' && Number.isFinite(m.sortOrder)
    );
    const before = await prisma.projectTask.findMany({
      where: { id: { in: moves.map((m) => m.id) }, projectId },
      select: { id: true, status: true, title: true },
    });
    const beforeById = new Map<string, { status: string; title: string }>(
      before.map((t) => [t.id, { status: t.status, title: t.title }])
    );
    const statusChanges = moves.flatMap((m) => {
      const prev = beforeById.get(m.id);
      if (!prev || prev.status === m.status) return [];
      if (!isAllowedProjectTaskStatus(m.status, settings)) return [];
      return [{ id: m.id, title: prev.title, from: prev.status, to: m.status }];
    });

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
    const actorName = session.user.name || session.user.email || 'User';
    if (statusChanges.length > 0) {
      await prisma.projectTaskActivity.createMany({
        data: statusChanges.map((c) => ({
          taskId: c.id,
          actorId: session.user.id,
          eventType: 'STATUS_CHANGED',
          description: `${actorName} changed status from ${c.from} to ${c.to}`,
          metadata: { from: c.from, to: c.to },
        })),
      });
      after(async () => {
        const { notifyProjectTaskUpdated } = await import('@/lib/projects/task-notifications');
        const { dispatchWorkflowEvent } = await import('@/lib/workflows/executor');
        for (const c of statusChanges) {
          await notifyProjectTaskUpdated({
            companyId,
            projectId,
            taskId: c.id,
            taskTitle: c.title,
            actorId: session.user.id,
            actorName,
            summary: `status → ${c.to}`,
          });
          await dispatchWorkflowEvent('project.task.status_changed', {
            userId: session.user.id,
            companyId,
            title: c.title,
            summary: `${actorName} changed status to ${c.to}`,
            metadata: { projectId, taskId: c.id, status: c.to, previousStatus: c.from },
          });
        }
      });
    }

    const progress = await syncProjectProgress(projectId, companyId);
    const tasks = await prisma.projectTask.findMany({
      where: { projectId, parentTaskId: null },
      include: {
        assignee: { select: { id: true, name: true, email: true, image: true } },
        _count: { select: { subtasks: true } },
      },
      orderBy: [{ status: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return jsonOk({ tasks, progress });
  }

  const taskId = typeof body.id === 'string' ? body.id : '';
  if (!taskId) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const result = await updateProjectTask({ session, companyId, projectId, taskId, body });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  if (result.changed) after(result.effects);
  return jsonOk({ task: result.task, progress: result.progress });
});

export const DELETE = withTenantRoute(async (request, { session, companyId }, routeContext) => {
  const projectId = (await routeContext!.params).id;
  if (!(await canWriteProjectDelivery(session, companyId, projectId))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
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
  const progress = await syncProjectProgress(projectId, companyId);
  return jsonOk({ ok: true, progress });
});
