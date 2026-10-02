import { NextResponse, after } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';
import { hasLegacyRole } from '@/lib/auth/permissions';
import { canWriteProjectDelivery } from '@/lib/projects/task-access';
import { stripHtmlToPreview } from '@/lib/projects/task-activity';
import { isRichTextEmpty, sanitizeRichText } from '@/lib/html/sanitize-rich-text';
import { newMentionIds } from '@/lib/projects/mentions';

async function findComment(companyId: string, projectId: string, taskId: string, commentId: string) {
  return prisma.projectTaskComment.findFirst({
    where: { id: commentId, taskId, task: { projectId, project: { companyId } } },
    select: { id: true, authorId: true, body: true, task: { select: { title: true } } },
  });
}

/** PATCH — edit your own comment. Newly @mentioned people are notified. */
export const PATCH = withTenantRoute(async (request, { session, companyId }, routeContext) => {
  const { id: projectId, taskId, commentId } = await routeContext!.params;
  if (!(await canWriteProjectDelivery(session, companyId, projectId))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const comment = await findComment(companyId, projectId, taskId, commentId);
  if (!comment) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (comment.authorId !== session.user.id) {
    return NextResponse.json({ error: 'You can only edit your own comments' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const html = sanitizeRichText(typeof body.body === 'string' ? body.body : '');
  if (isRichTextEmpty(html)) {
    return NextResponse.json({ error: 'Comment required' }, { status: 400 });
  }

  const updated = await prisma.projectTaskComment.update({
    where: { id: comment.id },
    data: { body: html },
    include: { author: { select: { id: true, name: true, email: true, image: true } } },
  });

  const added = newMentionIds(comment.body, html);
  if (added.length > 0) {
    after(async () => {
      const { notifyProjectMentions } = await import('@/lib/projects/task-notifications');
      await notifyProjectMentions({
        companyId,
        projectId,
        actorId: session.user.id,
        actorName: session.user.name || session.user.email || 'Someone',
        mentionedIds: added,
        excerpt: stripHtmlToPreview(html, 240),
        target: { kind: 'task-comment', taskId, title: comment.task.title },
      });
    });
  }

  return jsonOk(updated);
});

/** DELETE — your own comment, or any comment for workspace admins. Its files stay on the task. */
export const DELETE = withTenantRoute(async (_request, { session, companyId }, routeContext) => {
  const { id: projectId, taskId, commentId } = await routeContext!.params;
  if (!(await canWriteProjectDelivery(session, companyId, projectId))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const comment = await findComment(companyId, projectId, taskId, commentId);
  if (!comment) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const isAdmin = hasLegacyRole(session, 'ADMIN', 'SUPER_ADMIN');
  if (comment.authorId !== session.user.id && !isAdmin) {
    return NextResponse.json({ error: 'You can only delete your own comments' }, { status: 403 });
  }

  await prisma.projectTaskComment.delete({ where: { id: comment.id } });
  return jsonOk({ ok: true });
});
