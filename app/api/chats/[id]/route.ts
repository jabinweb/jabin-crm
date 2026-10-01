import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenantRoute } from '@/lib/api/with-route';
import { isWorkspaceStaff } from '@/lib/auth/workspace-staff';
import { publishRealtime } from '@/lib/realtime/hub';
import { REALTIME_EVENTS } from '@/lib/realtime/events';

const MAX_LENGTH = 5000;

type Row = {
  id: string;
  content: string;
  senderId: string;
  receiverId: string;
  readAt: Date | null;
  createdAt: Date;
};

/** Shape the chat UI expects. */
function toClient(message: Row) {
  return {
    id: message.id,
    content: message.content,
    senderId: message.senderId,
    receiverId: message.receiverId,
    status: message.readAt ? 'READ' : 'SENT',
    type: 'TEXT',
    createdAt: message.createdAt.toISOString(),
    timestamp: message.createdAt.toISOString(),
  };
}

/** GET /api/chats/[userId] — the latest 200 messages with that teammate in this workspace. */
export const GET = withTenantRoute(async (_request, { session, companyId }, routeContext) => {
  const otherId = (await routeContext!.params).id;
  const me = session.user.id;

  const latest = await prisma.directMessage.findMany({
    where: {
      companyId,
      OR: [
        { senderId: me, receiverId: otherId },
        { senderId: otherId, receiverId: me },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  return NextResponse.json((latest as Row[]).reverse().map(toClient), {
    headers: { 'Cache-Control': 'no-store' },
  });
});

/** POST /api/chats/[userId] — send a message to a teammate in this workspace. */
export const POST = withTenantRoute(async (request, { session, companyId }, routeContext) => {
  const receiverId = (await routeContext!.params).id;
  const me = session.user.id;

  const body = await request.json().catch(() => ({}));
  const content = typeof body.content === 'string' ? body.content.trim() : '';
  if (!content) return NextResponse.json({ error: 'Message is empty' }, { status: 400 });
  if (content.length > MAX_LENGTH) {
    return NextResponse.json({ error: `Messages are limited to ${MAX_LENGTH} characters` }, { status: 400 });
  }
  if (receiverId === me) {
    return NextResponse.json({ error: 'You cannot message yourself' }, { status: 400 });
  }
  if (!(await isWorkspaceStaff(companyId, receiverId))) {
    return NextResponse.json({ error: 'That person is not in this workspace' }, { status: 404 });
  }

  const message = (await prisma.directMessage.create({
    data: { companyId, senderId: me, receiverId, content },
  })) as Row;

  const payload = toClient(message);
  void publishRealtime(
    REALTIME_EVENTS.DIRECT_MESSAGE,
    companyId,
    { ...payload, senderName: session.user.name || session.user.email || 'Teammate' },
    receiverId
  ).catch(() => undefined);

  return NextResponse.json(payload, { status: 201 });
});
