import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';
import { DOC_PRESENCE_WINDOW_MS, assertProjectDoc } from '@/lib/projects/docs';

/**
 * Heartbeat from an open doc. Records the caller as present and returns who else
 * is here plus the doc's latest save, so the client can pull in remote edits.
 */
export const POST = withTenantRoute(async (_request, { session, companyId }, routeContext) => {
  const params = await routeContext!.params;
  const doc = await assertProjectDoc(companyId, params.id, params.docId);
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const now = new Date();
  await prisma.projectDocPresence.upsert({
    where: { docId_userId: { docId: doc.id, userId: session.user.id } },
    create: { docId: doc.id, userId: session.user.id, lastSeenAt: now },
    update: { lastSeenAt: now },
  });

  const [viewers] = await Promise.all([
    prisma.projectDocPresence.findMany({
      where: {
        docId: doc.id,
        userId: { not: session.user.id },
        lastSeenAt: { gte: new Date(now.getTime() - DOC_PRESENCE_WINDOW_MS) },
      },
      select: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
      orderBy: { lastSeenAt: 'desc' },
      take: 12,
    }),
    prisma.projectDocPresence.deleteMany({
      where: { lastSeenAt: { lt: new Date(now.getTime() - 10 * 60_000) } },
    }),
  ]);

  return jsonOk({
    viewers: viewers.map((v) => v.user),
    updatedAt: doc.updatedAt,
    updatedById: doc.updatedById,
  });
});

/** Leaving the doc — drop presence right away instead of waiting for it to expire. */
export const DELETE = withTenantRoute(async (_request, { session, companyId }, routeContext) => {
  const params = await routeContext!.params;
  const doc = await assertProjectDoc(companyId, params.id, params.docId);
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.projectDocPresence.deleteMany({
    where: { docId: doc.id, userId: session.user.id },
  });
  return jsonOk({ ok: true });
});
