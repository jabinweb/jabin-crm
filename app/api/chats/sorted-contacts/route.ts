import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenantRoute } from '@/lib/api/with-route';
import { workspaceStaffWhere } from '@/lib/auth/workspace-staff';

type Contact = { id: string; name: string | null; email: string; image: string | null };
type LastMessage = { senderId: string; receiverId: string; content: string; createdAt: Date };

/**
 * Team chat contacts: every active staff member of the current workspace (no employee
 * profile needed), most recent conversation first.
 */
export const GET = withTenantRoute(async (_request, { session, companyId }) => {
  const me = session.user.id;

  const [people, recent, unread] = await Promise.all([
    prisma.user.findMany({
      where: { id: { not: me }, userStatus: 'ACTIVE', ...workspaceStaffWhere(companyId) },
      select: { id: true, name: true, email: true, image: true },
      orderBy: { name: 'asc' },
    }),
    // Newest message per conversation partner
    prisma.directMessage.findMany({
      where: { companyId, OR: [{ senderId: me }, { receiverId: me }] },
      orderBy: { createdAt: 'desc' },
      distinct: ['senderId', 'receiverId'],
      select: { senderId: true, receiverId: true, content: true, createdAt: true },
      take: 500,
    }),
    prisma.directMessage.groupBy({
      by: ['senderId'],
      where: { companyId, receiverId: me, readAt: null },
      _count: { _all: true },
    }),
  ]);

  const lastByContact = new Map<string, LastMessage>();
  for (const message of recent as LastMessage[]) {
    const other = message.senderId === me ? message.receiverId : message.senderId;
    const current = lastByContact.get(other);
    if (!current || current.createdAt < message.createdAt) lastByContact.set(other, message);
  }
  const unreadBy = new Map<string, number>(
    (unread as Array<{ senderId: string; _count: { _all: number } }>).map((row) => [
      row.senderId,
      row._count._all,
    ])
  );

  const contacts = (people as Contact[])
    .map((person) => {
      const last = lastByContact.get(person.id);
      const unreadCount = unreadBy.get(person.id) ?? 0;
      return {
        id: person.id,
        name: person.name || person.email,
        avatar: person.image,
        lastMessageContent: last?.content ?? null,
        lastMessageTimestamp: last?.createdAt ?? null,
        isUnread: unreadCount > 0,
        unreadCount,
      };
    })
    .sort((a, b) => {
      if (a.lastMessageTimestamp && b.lastMessageTimestamp) {
        return b.lastMessageTimestamp.getTime() - a.lastMessageTimestamp.getTime();
      }
      if (a.lastMessageTimestamp) return -1;
      if (b.lastMessageTimestamp) return 1;
      return a.name.localeCompare(b.name);
    });

  return NextResponse.json(contacts, { headers: { 'Cache-Control': 'no-store' } });
});
