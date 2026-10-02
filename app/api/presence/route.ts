import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';
import { workspaceStaffWhere } from '@/lib/auth/workspace-staff';
import { DOC_PRESENCE_WINDOW_MS } from '@/lib/projects/docs';
import {
  ONLINE_WINDOW_MS,
  TICKET_VIEW_WINDOW_MS,
  type PresencePerson,
  type PresenceSnapshot,
} from '@/lib/presence';

const PERSON = { id: true, name: true, email: true, image: true } as const;

/**
 * POST /api/presence — heartbeat + snapshot in one call (every 30s from the dashboard):
 * marks the caller online and returns who is online, and who has which ticket / doc open.
 */
export const POST = withTenantRoute(async (_request, { session, companyId }) => {
  if (session.user.role === 'CUSTOMER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const me = session.user.id;
  const now = Date.now();

  // At most one write per ~25s per user
  await prisma.user.updateMany({
    where: {
      id: me,
      OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: new Date(now - 25_000) } }],
    },
    data: { lastSeenAt: new Date(now) },
  });

  const [online, ticketRows, docRows] = await Promise.all([
    prisma.user.findMany({
      where: {
        ...workspaceStaffWhere(companyId),
        userStatus: 'ACTIVE',
        lastSeenAt: { gte: new Date(now - ONLINE_WINDOW_MS) },
      },
      select: { ...PERSON, lastSeenAt: true },
      orderBy: { name: 'asc' },
      take: 100,
    }),
    prisma.ticketActivity.findMany({
      where: {
        eventType: 'PRESENCE',
        createdAt: { gte: new Date(now - TICKET_VIEW_WINDOW_MS) },
        performedById: { not: null },
        ticket: { customer: { companyId } },
      },
      select: { ticketId: true, metadata: true, performedBy: { select: PERSON } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    prisma.projectDocPresence.findMany({
      where: {
        lastSeenAt: { gte: new Date(now - DOC_PRESENCE_WINDOW_MS) },
        doc: { project: { companyId } },
      },
      select: { docId: true, user: { select: PERSON } },
      take: 200,
    }),
  ]);

  const tickets: PresenceSnapshot['tickets'] = {};
  for (const row of ticketRows) {
    if (!row.performedBy) continue;
    const list = (tickets[row.ticketId] ??= []);
    if (list.some((p) => p.id === row.performedBy!.id)) continue;
    const typing = (row.metadata as { typing?: boolean } | null)?.typing === true;
    list.push({ ...(row.performedBy as PresencePerson), typing });
  }

  const docs: PresenceSnapshot['docs'] = {};
  for (const row of docRows) {
    const list = (docs[row.docId] ??= []);
    if (!list.some((p) => p.id === row.user.id)) list.push(row.user as PresencePerson);
  }

  const snapshot: PresenceSnapshot = {
    me,
    online: online.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      image: u.image,
      lastSeenAt: (u.lastSeenAt ?? new Date(now)).toISOString(),
    })),
    tickets,
    docs,
  };
  return jsonOk(snapshot);
});
