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

  const comments = await prisma.projectTaskComment.findMany({
    where: { taskId: params.taskId },
    orderBy: { createdAt: 'asc' },
    include: {
      author: { select: { id: true, name: true, email: true, image: true } },
      attachments: true,
    },
  });
  return jsonOk(comments);
});

export const POST = withTenantRoute(async (request, { session, companyId }, routeContext) => {
  const params = await routeContext!.params;
  if (!(await canWriteProjectDelivery(session, companyId, params.id))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const task = await assertProjectTask(companyId, params.id, params.taskId);
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json();
  const rawBody =
    typeof body.body === 'string'
      ? body.body
      : typeof body.content === 'string'
        ? body.content
        : '';
  if (!rawBody.trim() || rawBody.replace(/<[^>]+>/g, '').trim() === '') {
    return NextResponse.json({ error: 'Comment required' }, { status: 400 });
  }

  const comment = await prisma.projectTaskComment.create({
    data: {
      taskId: params.taskId,
      authorId: session.user.id,
      body: rawBody,
    },
    include: {
      author: { select: { id: true, name: true, email: true, image: true } },
    },
  });

  const attachmentUrls = Array.isArray(body.attachments) ? body.attachments : [];
  if (attachmentUrls.length > 0) {
    await prisma.projectTaskAttachment.createMany({
      data: attachmentUrls
        .filter((a: { url?: string }) => a && typeof a.url === 'string')
        .map(
          (a: {
            url: string;
            name?: string;
            mimeType?: string;
            size?: number;
            fileId?: string;
          }) => ({
            taskId: params.taskId,
            commentId: comment.id,
            url: a.url,
            name: a.name || null,
            mimeType: a.mimeType || null,
            size: typeof a.size === 'number' ? a.size : null,
            fileId: a.fileId || null,
            uploadedById: session.user.id,
            source: 'COMMENT',
          })
        ),
    });
  }

  const actorName = session.user.name || session.user.email || 'User';
  await logProjectTaskActivity({
    taskId: params.taskId,
    actorId: session.user.id,
    eventType: 'COMMENT_ADDED',
    description: `${actorName} added a comment`,
    metadata: { commentId: comment.id },
  });

  // Auto-watch commenter
  await prisma.projectTaskWatcher.upsert({
    where: {
      taskId_userId: { taskId: params.taskId, userId: session.user.id },
    },
    create: { taskId: params.taskId, userId: session.user.id },
    update: {},
  });

  const taskRow = await prisma.projectTask.findUnique({
    where: { id: params.taskId },
    select: { title: true },
  });
  const { notifyProjectTaskCommented } = await import('@/lib/projects/task-notifications');
  void notifyProjectTaskCommented({
    companyId,
    projectId: params.id,
    taskId: params.taskId,
    taskTitle: taskRow?.title || 'Task',
    actorId: session.user.id,
    actorName,
  });

  return jsonOk(comment, { status: 201 });
});
