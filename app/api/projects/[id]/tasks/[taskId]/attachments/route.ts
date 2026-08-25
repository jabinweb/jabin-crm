import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hasLegacyRole } from '@/lib/auth/permissions';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';
import {
  assertProjectTask,
  logProjectTaskActivity,
} from '@/lib/projects/task-activity';

export const GET = withTenantRoute(async (_request, { companyId }, routeContext) => {
  const params = await routeContext!.params;
  const task = await assertProjectTask(companyId, params.id, params.taskId);
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const attachments = await prisma.projectTaskAttachment.findMany({
    where: { taskId: params.taskId },
    orderBy: { createdAt: 'desc' },
    include: {
      uploadedBy: { select: { id: true, name: true } },
    },
  });
  return jsonOk({ attachments });
});

export const POST = withTenantRoute(async (request, { session, companyId }, routeContext) => {
  if (!hasLegacyRole(session, 'SUPER_ADMIN', 'ADMIN', 'SALES')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const params = await routeContext!.params;
  const task = await assertProjectTask(companyId, params.id, params.taskId);
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json();
  const url = typeof body.url === 'string' ? body.url.trim() : '';
  if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 });

  const source =
    typeof body.source === 'string' &&
    ['DESCRIPTION', 'COMMENT', 'SIDEBAR'].includes(body.source)
      ? body.source
      : 'SIDEBAR';

  const attachment = await prisma.projectTaskAttachment.create({
    data: {
      taskId: params.taskId,
      url,
      name: typeof body.name === 'string' ? body.name : null,
      mimeType: typeof body.mimeType === 'string' ? body.mimeType : null,
      size: typeof body.size === 'number' ? body.size : null,
      fileId: typeof body.fileId === 'string' ? body.fileId : null,
      uploadedById: session.user.id,
      source,
      commentId: typeof body.commentId === 'string' ? body.commentId : null,
    },
    include: {
      uploadedBy: { select: { id: true, name: true } },
    },
  });

  const actorName = session.user.name || session.user.email || 'User';
  await logProjectTaskActivity({
    taskId: params.taskId,
    actorId: session.user.id,
    eventType: 'ATTACHMENT_ADDED',
    description: `${actorName} attached ${attachment.name || 'a file'}`,
    metadata: { attachmentId: attachment.id, url },
  });

  return jsonOk(attachment, { status: 201 });
});

export const DELETE = withTenantRoute(async (request, { session, companyId }, routeContext) => {
  if (!hasLegacyRole(session, 'SUPER_ADMIN', 'ADMIN', 'SALES')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const params = await routeContext!.params;
  const task = await assertProjectTask(companyId, params.id, params.taskId);
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const url = new URL(request.url);
  const attachmentId = url.searchParams.get('attachmentId');
  if (!attachmentId) {
    return NextResponse.json({ error: 'attachmentId required' }, { status: 400 });
  }

  const deleted = await prisma.projectTaskAttachment.deleteMany({
    where: { id: attachmentId, taskId: params.taskId },
  });
  if (!deleted.count) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return jsonOk({ ok: true });
});
