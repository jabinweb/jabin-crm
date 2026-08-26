import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';
import { canWriteProjectDelivery } from '@/lib/projects/task-access';
import { assertProjectTask } from '@/lib/projects/task-activity';

export const GET = withTenantRoute(async (_request, { companyId }, routeContext) => {
  const params = await routeContext!.params;
  const task = await assertProjectTask(companyId, params.id, params.taskId);
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const worklogs = await prisma.projectTaskWorklog.findMany({
    where: { taskId: params.taskId },
    orderBy: { loggedAt: 'desc' },
    take: 50,
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
    },
  });
  return jsonOk(worklogs);
});

export const POST = withTenantRoute(async (request, { session, companyId }, routeContext) => {
  const params = await routeContext!.params;
  if (!(await canWriteProjectDelivery(session, companyId, params.id))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const task = await assertProjectTask(companyId, params.id, params.taskId);
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json();
  const hours = Number(body.hours);
  if (!Number.isFinite(hours) || hours <= 0) {
    return NextResponse.json({ error: 'Valid hours required' }, { status: 400 });
  }

  const worklog = await prisma.projectTaskWorklog.create({
    data: {
      taskId: params.taskId,
      userId: session.user.id,
      hours,
      note: typeof body.note === 'string' ? body.note.trim() || null : null,
      loggedAt: body.loggedAt ? new Date(body.loggedAt) : new Date(),
    },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
    },
  });

  return jsonOk(worklog, { status: 201 });
});
