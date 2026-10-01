import { NextResponse, after } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';
import { canWriteProjectDelivery } from '@/lib/projects/task-access';
import {
  PROJECT_DOC_DETAIL_INCLUDE,
  assertProjectDoc,
  isSelfOrDescendant,
  nextDocSortOrder,
  publishProjectDocChange,
} from '@/lib/projects/docs';
import { sanitizeRichText } from '@/lib/html/sanitize-rich-text';
import { newMentionIds } from '@/lib/projects/mentions';
import { stripHtmlToPreview } from '@/lib/projects/task-activity';

export const GET = withTenantRoute(async (_request, { companyId }, routeContext) => {
  const params = await routeContext!.params;
  const doc = await prisma.projectDoc.findFirst({
    where: { id: params.docId, projectId: params.id, project: { companyId } },
    include: PROJECT_DOC_DETAIL_INCLUDE,
  });
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return jsonOk(doc);
});

export const PATCH = withTenantRoute(async (request, { session, companyId }, routeContext) => {
  const params = await routeContext!.params;
  const projectId = params.id;
  const docId = params.docId;
  if (!(await canWriteProjectDelivery(session, companyId, projectId))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const existing = await assertProjectDoc(companyId, projectId, docId);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  let action: 'updated' | 'moved' = 'updated';

  if (typeof body.title === 'string') {
    const title = body.title.trim().slice(0, 200) || 'Untitled';
    if (title !== existing.title) data.title = title;
  }

  if (body.icon !== undefined) {
    const icon = typeof body.icon === 'string' ? body.icon.trim().slice(0, 8) || null : null;
    if (icon !== existing.icon) data.icon = icon;
  }

  let mentionedIds: string[] = [];
  if (typeof body.contentHtml === 'string') {
    if (existing.kind !== 'PAGE') {
      return NextResponse.json({ error: 'Folders have no content' }, { status: 400 });
    }
    const contentHtml = sanitizeRichText(body.contentHtml);
    if (contentHtml !== (existing.contentHtml ?? '')) {
      // Someone else saved since this editor loaded the doc — do not overwrite their work
      if (
        typeof body.baseUpdatedAt === 'string' &&
        new Date(body.baseUpdatedAt).getTime() !== existing.updatedAt.getTime() &&
        existing.updatedById !== session.user.id
      ) {
        return NextResponse.json(
          {
            error: 'This doc was changed by someone else',
            code: 'DOC_CONFLICT',
            updatedAt: existing.updatedAt,
          },
          { status: 409 }
        );
      }
      data.contentHtml = contentHtml;
      mentionedIds = newMentionIds(existing.contentHtml, contentHtml);
    }
  }

  if (body.parentId !== undefined) {
    const parentId =
      typeof body.parentId === 'string' && body.parentId.trim()
        ? body.parentId.trim()
        : null;
    if (parentId !== existing.parentId) {
      if (parentId) {
        const parent = await prisma.projectDoc.findFirst({
          where: { id: parentId, projectId },
          select: { id: true },
        });
        if (!parent) {
          return NextResponse.json({ error: 'Parent not found' }, { status: 400 });
        }
        if (await isSelfOrDescendant(projectId, docId, parentId)) {
          return NextResponse.json(
            { error: 'Cannot move an item inside itself' },
            { status: 400 }
          );
        }
      }
      data.parentId = parentId;
      data.sortOrder = await nextDocSortOrder(projectId, parentId);
      action = 'moved';
    }
  }

  if (typeof body.sortOrder === 'number' && Number.isFinite(body.sortOrder)) {
    data.sortOrder = Math.round(body.sortOrder);
    action = 'moved';
  }

  if (Object.keys(data).length === 0) {
    const current = await prisma.projectDoc.findUnique({
      where: { id: docId },
      include: PROJECT_DOC_DETAIL_INCLUDE,
    });
    return jsonOk(current);
  }

  const doc = await prisma.projectDoc.update({
    where: { id: docId },
    data: { ...data, updatedById: session.user.id },
    include: PROJECT_DOC_DETAIL_INCLUDE,
  });

  const actorName = session.user.name || session.user.email || 'User';
  publishProjectDocChange({
    companyId,
    projectId,
    docId,
    action,
    actorId: session.user.id,
    actorName,
  });

  if (mentionedIds.length > 0) {
    after(async () => {
      const { notifyProjectMentions } = await import('@/lib/projects/task-notifications');
      await notifyProjectMentions({
        companyId,
        projectId,
        actorId: session.user.id,
        actorName,
        mentionedIds,
        excerpt: stripHtmlToPreview(doc.contentHtml, 240),
        target: { kind: 'doc', docId, title: doc.title },
      });
    });
  }

  return jsonOk(doc);
});

/** Deleting a folder or page removes everything nested under it (DB cascade). */
export const DELETE = withTenantRoute(async (_request, { session, companyId }, routeContext) => {
  const params = await routeContext!.params;
  if (!(await canWriteProjectDelivery(session, companyId, params.id))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const existing = await assertProjectDoc(companyId, params.id, params.docId);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.projectDoc.delete({ where: { id: params.docId } });

  publishProjectDocChange({
    companyId,
    projectId: params.id,
    docId: params.docId,
    action: 'deleted',
    actorId: session.user.id,
    actorName: session.user.name || session.user.email || 'User',
  });

  return jsonOk({ ok: true });
});
