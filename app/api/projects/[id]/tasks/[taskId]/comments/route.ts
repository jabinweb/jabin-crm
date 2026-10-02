import { NextResponse, after } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';
import { canWriteProjectDelivery } from '@/lib/projects/task-access';
import { assertProjectTask } from '@/lib/projects/task-activity';
import { sanitizeRichText } from '@/lib/html/sanitize-rich-text';
import { addProjectTaskComment } from '@/lib/projects/add-comment';

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
  return jsonOk(comments.map((c) => ({ ...c, body: sanitizeRichText(c.body) })));
});

export const POST = withTenantRoute(async (request, { session, companyId }, routeContext) => {
  const params = await routeContext!.params;
  if (!(await canWriteProjectDelivery(session, companyId, params.id))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const result = await addProjectTaskComment({
    session,
    companyId,
    projectId: params.id,
    taskId: params.taskId,
    bodyHtml:
      typeof body.body === 'string' ? body.body : typeof body.content === 'string' ? body.content : '',
    attachments: Array.isArray(body.attachments) ? body.attachments : [],
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  after(result.effects);
  return jsonOk(result.comment, { status: 201 });
});
