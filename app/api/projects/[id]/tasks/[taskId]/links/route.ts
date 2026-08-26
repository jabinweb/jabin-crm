import { NextResponse } from 'next/server';
import { ProjectTaskLinkType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';
import { canWriteProjectDelivery } from '@/lib/projects/task-access';
import { assertProjectTask } from '@/lib/projects/task-activity';

const LINK_TYPES = Object.values(ProjectTaskLinkType);

export const GET = withTenantRoute(async (_request, { companyId }, routeContext) => {
  const params = await routeContext!.params;
  const task = await assertProjectTask(companyId, params.id, params.taskId);
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [linksFrom, linksTo] = await Promise.all([
    prisma.projectTaskLink.findMany({
      where: { sourceTaskId: params.taskId },
      include: {
        targetTask: { select: { id: true, title: true, status: true } },
      },
    }),
    prisma.projectTaskLink.findMany({
      where: { targetTaskId: params.taskId },
      include: {
        sourceTask: { select: { id: true, title: true, status: true } },
      },
    }),
  ]);

  return jsonOk({ linksFrom, linksTo });
});

export const POST = withTenantRoute(async (request, { session, companyId }, routeContext) => {
  const params = await routeContext!.params;
  if (!(await canWriteProjectDelivery(session, companyId, params.id))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const task = await assertProjectTask(companyId, params.id, params.taskId);
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json();
  const targetTaskId =
    typeof body.targetTaskId === 'string' ? body.targetTaskId.trim() : '';
  if (!targetTaskId) {
    return NextResponse.json({ error: 'targetTaskId required' }, { status: 400 });
  }
  if (targetTaskId === params.taskId) {
    return NextResponse.json({ error: 'Cannot link task to itself' }, { status: 400 });
  }

  const target = await prisma.projectTask.findFirst({
    where: { id: targetTaskId, projectId: params.id },
    select: { id: true },
  });
  if (!target) {
    return NextResponse.json({ error: 'Target task not found' }, { status: 404 });
  }

  const type =
    typeof body.type === 'string' && LINK_TYPES.includes(body.type as ProjectTaskLinkType)
      ? (body.type as ProjectTaskLinkType)
      : ProjectTaskLinkType.RELATES_TO;

  const link = await prisma.projectTaskLink.create({
    data: {
      projectId: params.id,
      sourceTaskId: params.taskId,
      targetTaskId,
      type,
      createdById: session.user.id,
    },
    include: {
      targetTask: { select: { id: true, title: true, status: true } },
    },
  });

  return jsonOk(link, { status: 201 });
});

export const DELETE = withTenantRoute(async (request, { session, companyId }, routeContext) => {
  const params = await routeContext!.params;
  if (!(await canWriteProjectDelivery(session, companyId, params.id))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const task = await assertProjectTask(companyId, params.id, params.taskId);
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const url = new URL(request.url);
  const linkId = url.searchParams.get('linkId');
  if (!linkId) {
    return NextResponse.json({ error: 'linkId required' }, { status: 400 });
  }

  const deleted = await prisma.projectTaskLink.deleteMany({
    where: {
      id: linkId,
      OR: [{ sourceTaskId: params.taskId }, { targetTaskId: params.taskId }],
    },
  });
  if (!deleted.count) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return jsonOk({ ok: true });
});
