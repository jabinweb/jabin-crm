import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';
import { canWriteProjectDelivery } from '@/lib/projects/task-access';
import {
  assertProjectTask,
  logProjectTaskActivity,
} from '@/lib/projects/task-activity';

export const GET = withTenantRoute(async (_request, { session, companyId }, routeContext) => {
  const params = await routeContext!.params;
  const task = await assertProjectTask(companyId, params.id, params.taskId);
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const watchers = await prisma.projectTaskWatcher.findMany({
    where: { taskId: params.taskId },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
  const watching = watchers.some((w) => w.userId === session.user.id);
  return jsonOk({ watching, watchers });
});

export const POST = withTenantRoute(async (_request, { session, companyId }, routeContext) => {
  const params = await routeContext!.params;
  if (!(await canWriteProjectDelivery(session, companyId, params.id))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const task = await assertProjectTask(companyId, params.id, params.taskId);
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.projectTaskWatcher.upsert({
    where: {
      taskId_userId: { taskId: params.taskId, userId: session.user.id },
    },
    create: { taskId: params.taskId, userId: session.user.id },
    update: {},
  });

  const actorName = session.user.name || session.user.email || 'User';
  await logProjectTaskActivity({
    taskId: params.taskId,
    actorId: session.user.id,
    eventType: 'WATCHER_ADDED',
    description: `${actorName} started watching`,
  });

  return jsonOk({ watching: true });
});

export const DELETE = withTenantRoute(async (_request, { session, companyId }, routeContext) => {
  const params = await routeContext!.params;
  if (!(await canWriteProjectDelivery(session, companyId, params.id))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const task = await assertProjectTask(companyId, params.id, params.taskId);
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.projectTaskWatcher.deleteMany({
    where: { taskId: params.taskId, userId: session.user.id },
  });

  const actorName = session.user.name || session.user.email || 'User';
  await logProjectTaskActivity({
    taskId: params.taskId,
    actorId: session.user.id,
    eventType: 'WATCHER_REMOVED',
    description: `${actorName} stopped watching`,
  });

  return jsonOk({ watching: false });
});
