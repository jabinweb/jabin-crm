import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';
import { canWriteProjectDelivery } from '@/lib/projects/task-access';
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
  const params = await routeContext!.params;
  if (!(await canWriteProjectDelivery(session, companyId, params.id))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const task = await assertProjectTask(companyId, params.id, params.taskId);
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const url = typeof body.url === 'string' ? body.url.trim() : '';
  if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 });
  // Rendered as a link — only http(s) or same-origin paths (no javascript:/data:)
  if (!/^(https?:\/\/|\/(?!\/))/i.test(url)) {
    return NextResponse.json({ error: 'Invalid url' }, { status: 400 });
  }

  let commentId: string | null = null;
  if (typeof body.commentId === 'string' && body.commentId) {
    const comment = await prisma.projectTaskComment.findFirst({
      where: { id: body.commentId, taskId: params.taskId },
      select: { id: true },
    });
    if (!comment) return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    commentId = comment.id;
  }

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
      commentId,
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
  const params = await routeContext!.params;
  if (!(await canWriteProjectDelivery(session, companyId, params.id))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
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
