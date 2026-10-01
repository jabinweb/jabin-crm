import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';
import { canWriteProjectDelivery } from '@/lib/projects/task-access';
import {
  PROJECT_DOC_KINDS,
  PROJECT_DOC_TREE_SELECT,
  assertProjectForDocs,
  nextDocSortOrder,
  publishProjectDocChange,
  type ProjectDocKind,
} from '@/lib/projects/docs';

/** Flat list of the project's folders and pages; the client builds the tree. */
export const GET = withTenantRoute(async (_request, { session, companyId }, routeContext) => {
  const projectId = (await routeContext!.params).id;
  const project = await assertProjectForDocs(companyId, projectId);
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [docs, canWrite] = await Promise.all([
    prisma.projectDoc.findMany({
      where: { projectId },
      select: PROJECT_DOC_TREE_SELECT,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    }),
    canWriteProjectDelivery(session, companyId, projectId),
  ]);

  return jsonOk({ project, docs, canWrite });
});

export const POST = withTenantRoute(async (request, { session, companyId }, routeContext) => {
  const projectId = (await routeContext!.params).id;
  if (!(await canWriteProjectDelivery(session, companyId, projectId))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const project = await assertProjectForDocs(companyId, projectId);
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const kind: ProjectDocKind = (PROJECT_DOC_KINDS as readonly string[]).includes(body.kind)
    ? body.kind
    : 'PAGE';
  const title =
    typeof body.title === 'string' && body.title.trim()
      ? body.title.trim().slice(0, 200)
      : kind === 'FOLDER'
        ? 'New folder'
        : 'Untitled';

  let parentId: string | null = null;
  if (typeof body.parentId === 'string' && body.parentId.trim()) {
    const parent = await prisma.projectDoc.findFirst({
      where: { id: body.parentId.trim(), projectId },
      select: { id: true },
    });
    if (!parent) {
      return NextResponse.json({ error: 'Parent not found' }, { status: 400 });
    }
    parentId = parent.id;
  }

  const doc = await prisma.projectDoc.create({
    data: {
      projectId,
      parentId,
      kind,
      title,
      icon: typeof body.icon === 'string' ? body.icon.trim().slice(0, 8) || null : null,
      contentHtml: kind === 'PAGE' ? '' : null,
      sortOrder: await nextDocSortOrder(projectId, parentId),
      createdById: session.user.id,
      updatedById: session.user.id,
    },
    select: PROJECT_DOC_TREE_SELECT,
  });

  publishProjectDocChange({
    companyId,
    projectId,
    docId: doc.id,
    action: 'created',
    actorId: session.user.id,
    actorName: session.user.name || session.user.email || 'User',
  });

  return jsonOk(doc, { status: 201 });
});
