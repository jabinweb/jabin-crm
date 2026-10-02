import { NextResponse, after } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';
import { canWriteProjectDelivery } from '@/lib/projects/task-access';
import { assertProjectTask } from '@/lib/projects/task-activity';
import { syncProjectProgress } from '@/lib/projects/sync-project-progress';
import { updateProjectTask } from '@/lib/projects/update-task';
import { sanitizeRichText } from '@/lib/html/sanitize-rich-text';

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
      project: {
        select: {
          id: true,
          name: true,
          pmUser: { select: { id: true, name: true, email: true, image: true } },
          members: {
            select: {
              user: { select: { id: true, name: true, email: true, image: true } },
            },
          },
        },
      },
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
  const memberOptions = [
    ...(task.project.pmUser ? [task.project.pmUser] : []),
    ...task.project.members.map((member) => member.user),
  ].filter(
    (person, index, arr) => arr.findIndex((candidate) => candidate.id === person.id) === index
  );
  return jsonOk({
    ...task,
    // Rendered as HTML on the client — re-sanitize rows written before sanitizing on save
    comments: task.comments.map((c) => ({ ...c, body: sanitizeRichText(c.body) })),
    watching,
    memberOptions,
    projectTaskStatuses: settings.projectTaskStatuses ?? null,
    // Same rule as every task write route — the page goes read-only when false
    canWrite: await canWriteProjectDelivery(session, companyId, projectId),
  });
});

export const PATCH = withTenantRoute(async (request, { session, companyId }, routeContext) => {
  const params = await routeContext!.params;
  const projectId = params.id;
  if (!(await canWriteProjectDelivery(session, companyId, projectId))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const result = await updateProjectTask({
    session,
    companyId,
    projectId,
    taskId: params.taskId,
    body,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  if (!result.changed) return jsonOk(result.task);

  after(result.effects);
  return jsonOk({ task: result.task, progress: result.progress });
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
  const progress = await syncProjectProgress(projectId, companyId);
  return jsonOk({ ok: true, progress });
});
