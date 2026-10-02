import { NextResponse, after } from 'next/server';
import { prisma } from '@/lib/prisma';
import { deleteProjectTask } from '@/lib/projects/delete-task';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';
import { canWriteProjectDelivery } from '@/lib/projects/task-access';
import { isAllowedProjectTaskStatus } from '@/lib/projects/task-statuses';
import {
  getCompanyProjectTaskSettings,
  syncProjectProgress,
} from '@/lib/projects/sync-project-progress';
import { PROJECT_TASK_LIST_INCLUDE } from '@/lib/projects/agency-delivery';
import { updateProjectTask } from '@/lib/projects/update-task';
import { createProjectTask } from '@/lib/projects/create-task';

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
  const body = await request.json();
  const result = await createProjectTask({ session, companyId, projectId, body });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  after(result.effects);
  return jsonOk({ task: result.task, progress: result.progress }, { status: 201 });
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

  const result = await deleteProjectTask({ session, companyId, projectId, taskId });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  after(result.effects);
  return jsonOk({ ok: true, progress: result.progress });
});
