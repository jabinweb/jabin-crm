import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';
import { canWriteProjectDelivery } from '@/lib/projects/task-access';
import {
  PROJECT_PRIORITIES,
  computeProgressFromTasks,
} from '@/lib/projects/task-board';
import { isAllowedProjectTaskStatus, resolveDoneStatusIds } from '@/lib/projects/task-statuses';
import {
  assertProjectTask,
  logProjectTaskActivity,
  stripHtmlToPreview,
} from '@/lib/projects/task-activity';

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

export const GET = withTenantRoute(async (_request, { session, companyId }, routeContext) => {
  const params = await routeContext!.params;
  const projectId = params.id;
  const taskId = params.taskId;

  const task = await prisma.projectTask.findFirst({
    where: {
      id: taskId,
      projectId,
      project: { companyId },
    },
    include: {
      assignee: { select: { id: true, name: true, email: true, image: true } },
      reporter: { select: { id: true, name: true, email: true, image: true } },
      project: { select: { id: true, name: true } },
      parentTask: {
        select: { id: true, title: true },
      },
      subtasks: {
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        include: {
          assignee: {
            select: { id: true, name: true, email: true, image: true },
          },
        },
      },
      watchers: {
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
      attachments: {
        orderBy: { createdAt: 'desc' },
        include: {
          uploadedBy: { select: { id: true, name: true } },
        },
      },
      comments: {
        orderBy: { createdAt: 'asc' },
        include: {
          author: { select: { id: true, name: true, email: true, image: true } },
        },
      },
      activities: {
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          actor: { select: { id: true, name: true, email: true, image: true } },
        },
      },
      _count: {
        select: {
          comments: true,
          watchers: true,
          attachments: true,
          subtasks: true,
        },
      },
      labels: {
        include: {
          label: { select: { id: true, name: true, color: true } },
        },
      },
      linksFrom: {
        include: {
          targetTask: { select: { id: true, title: true, status: true } },
        },
      },
      linksTo: {
        include: {
          sourceTask: { select: { id: true, title: true, status: true } },
        },
      },
      worklogs: {
        orderBy: { loggedAt: 'desc' },
        take: 20,
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
        },
      },
    },
  });

  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { settings: true },
  });
  const settings =
    company?.settings && typeof company.settings === 'object'
      ? (company.settings as Record<string, unknown>)
      : {};

  const watching = task.watchers.some((w) => w.userId === session.user.id);
  return jsonOk({
    ...task,
    watching,
    projectTaskStatuses: settings.projectTaskStatuses ?? null,
  });
});

export const PATCH = withTenantRoute(async (request, { session, companyId }, routeContext) => {
  const params = await routeContext!.params;
  const projectId = params.id;
  if (!(await canWriteProjectDelivery(session, companyId, projectId))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const taskId = params.taskId;

  const existing = await assertProjectTask(companyId, projectId, taskId);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json();
  const settings = await companySettings(companyId);
  const data: Record<string, unknown> = {};
  const actorName = session.user.name || session.user.email || 'User';

  if (typeof body.title === 'string') {
    const title = body.title.trim();
    if (!title) return NextResponse.json({ error: 'Title required' }, { status: 400 });
    if (title !== existing.title) {
      data.title = title;
      await logProjectTaskActivity({
        taskId,
        actorId: session.user.id,
        eventType: 'TITLE_UPDATED',
        description: `${actorName} updated the title`,
        metadata: { from: existing.title, to: title },
      });
    }
  }

  if (typeof body.descriptionHtml === 'string') {
    data.descriptionHtml = body.descriptionHtml;
    data.description = stripHtmlToPreview(body.descriptionHtml);
    await logProjectTaskActivity({
      taskId,
      actorId: session.user.id,
      eventType: 'DESCRIPTION_UPDATED',
      description: `${actorName} updated the description`,
    });
  } else if (typeof body.description === 'string') {
    data.description = body.description;
  }

  if (typeof body.status === 'string' && body.status !== existing.status) {
    if (!isAllowedProjectTaskStatus(body.status, settings)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }
    data.status = body.status;
    await logProjectTaskActivity({
      taskId,
      actorId: session.user.id,
      eventType: 'STATUS_CHANGED',
      description: `${actorName} changed status from ${existing.status} to ${body.status}`,
      metadata: { from: existing.status, to: body.status },
    });
  }

  if (
    typeof body.priority === 'string' &&
    (PROJECT_PRIORITIES as readonly string[]).includes(body.priority) &&
    body.priority !== existing.priority
  ) {
    data.priority = body.priority;
    await logProjectTaskActivity({
      taskId,
      actorId: session.user.id,
      eventType: 'PRIORITY_CHANGED',
      description: `${actorName} changed priority from ${existing.priority} to ${body.priority}`,
      metadata: { from: existing.priority, to: body.priority },
    });
  }

  let assigneeChangedTo: string | null | undefined;
  if (body.assigneeId !== undefined) {
    const nextAssignee =
      typeof body.assigneeId === 'string' && body.assigneeId.trim()
        ? body.assigneeId.trim()
        : null;
    if (nextAssignee !== existing.assigneeId) {
      assigneeChangedTo = nextAssignee;
      data.assigneeId = nextAssignee;
      await logProjectTaskActivity({
        taskId,
        actorId: session.user.id,
        eventType: 'ASSIGNEE_CHANGED',
        description: nextAssignee
          ? `${actorName} changed the assignee`
          : `${actorName} unassigned the task`,
        metadata: { from: existing.assigneeId, to: nextAssignee },
      });
    }
  }

  if (body.dueDate !== undefined) {
    const nextDue = body.dueDate ? new Date(body.dueDate) : null;
    data.dueDate = nextDue;
    await logProjectTaskActivity({
      taskId,
      actorId: session.user.id,
      eventType: 'DUE_DATE_CHANGED',
      description: `${actorName} updated the due date`,
      metadata: {
        from: existing.dueDate?.toISOString() ?? null,
        to: nextDue?.toISOString() ?? null,
      },
    });
  }

  if (Object.keys(data).length === 0) {
    return jsonOk(existing);
  }

  const task = await prisma.projectTask.update({
    where: { id: taskId },
    data,
    include: {
      assignee: { select: { id: true, name: true, email: true, image: true } },
      reporter: { select: { id: true, name: true, email: true, image: true } },
    },
  });

  const notifyBase = {
    companyId,
    projectId,
    taskId,
    taskTitle: task.title,
    actorId: session.user.id,
    actorName,
  };

  if (assigneeChangedTo) {
    const { notifyProjectTaskAssigned } = await import('@/lib/projects/task-notifications');
    void notifyProjectTaskAssigned({ ...notifyBase, assigneeId: assigneeChangedTo });
  }

  if (typeof body.status === 'string' && body.status !== existing.status) {
    const { notifyProjectTaskUpdated } = await import('@/lib/projects/task-notifications');
    void notifyProjectTaskUpdated({
      ...notifyBase,
      summary: `status → ${body.status}`,
    });

    const { dispatchWorkflowEvent } = await import('@/lib/workflows/executor');
    void dispatchWorkflowEvent('project.task.status_changed', {
      userId: session.user.id,
      companyId,
      title: task.title,
      summary: `${actorName} changed status to ${body.status}`,
      metadata: {
        projectId,
        taskId,
        status: body.status,
        previousStatus: existing.status,
      },
    });
  }

  const progress = await syncProgress(projectId, companyId);
  return jsonOk({ task, progress });
});

export const DELETE = withTenantRoute(async (_request, { session, companyId }, routeContext) => {
  const params = await routeContext!.params;
  const projectId = params.id;
  if (!(await canWriteProjectDelivery(session, companyId, projectId))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const taskId = params.taskId;

  const existing = await assertProjectTask(companyId, projectId, taskId);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.projectTask.delete({ where: { id: taskId } });
  const progress = await syncProgress(projectId, companyId);
  return jsonOk({ ok: true, progress });
});
