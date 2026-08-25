import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';
import { canWriteProjectDelivery } from '@/lib/projects/task-access';
import { assertProjectTask } from '@/lib/projects/task-activity';

export const GET = withTenantRoute(async (_request, { companyId }, routeContext) => {
  const params = await routeContext!.params;
  const task = await assertProjectTask(companyId, params.id, params.taskId);
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const labels = await prisma.projectTaskLabel.findMany({
    where: { taskId: params.taskId },
    include: {
      label: { select: { id: true, name: true, color: true } },
    },
  });
  return jsonOk(labels);
});

export const POST = withTenantRoute(async (request, { session, companyId }, routeContext) => {
  const params = await routeContext!.params;
  if (!(await canWriteProjectDelivery(session, companyId, params.id))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const task = await assertProjectTask(companyId, params.id, params.taskId);
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json();
  let labelId = typeof body.labelId === 'string' ? body.labelId.trim() : '';

  if (!labelId) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) {
      return NextResponse.json({ error: 'labelId or name required' }, { status: 400 });
    }
    const color = typeof body.color === 'string' ? body.color.trim() : 'slate';
    const label = await prisma.projectLabel.upsert({
      where: { companyId_name: { companyId, name } },
      create: { companyId, name, color },
      update: {},
    });
    labelId = label.id;
  } else {
    const label = await prisma.projectLabel.findFirst({
      where: { id: labelId, companyId },
    });
    if (!label) {
      return NextResponse.json({ error: 'Label not found' }, { status: 404 });
    }
  }

  const attached = await prisma.projectTaskLabel.upsert({
    where: { taskId_labelId: { taskId: params.taskId, labelId } },
    create: { taskId: params.taskId, labelId },
    update: {},
    include: {
      label: { select: { id: true, name: true, color: true } },
    },
  });

  return jsonOk(attached, { status: 201 });
});

export const DELETE = withTenantRoute(async (request, { session, companyId }, routeContext) => {
  const params = await routeContext!.params;
  if (!(await canWriteProjectDelivery(session, companyId, params.id))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const task = await assertProjectTask(companyId, params.id, params.taskId);
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const url = new URL(request.url);
  const labelId = url.searchParams.get('labelId');
  if (!labelId) {
    return NextResponse.json({ error: 'labelId required' }, { status: 400 });
  }

  const deleted = await prisma.projectTaskLabel.deleteMany({
    where: { taskId: params.taskId, labelId },
  });
  if (!deleted.count) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return jsonOk({ ok: true });
});
