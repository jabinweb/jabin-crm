import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';
import {
  MAX_MESSAGE_LENGTH,
  MESSAGE_INCLUDE,
  canPost,
  loadMembership,
  normalizeAttachments,
  postMessage,
  serializeMessage,
} from '@/lib/messaging/service';

const PAGE_SIZE = 50;

/** GET ?before=<messageId> — newest page of messages (oldest first within the page). */
export const GET = withTenantRoute(async (request, { session, companyId }, routeContext) => {
  const id = (await routeContext!.params).id;
  const access = await loadMembership(companyId, id, session.user.id);
  if (!access) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const before = new URL(request.url).searchParams.get('before');
  let cursorDate: Date | undefined;
  if (before) {
    const anchor = await prisma.chatMessage.findFirst({
      where: { id: before, conversationId: id },
      select: { createdAt: true },
    });
    cursorDate = anchor?.createdAt;
  }

  const rows = await prisma.chatMessage.findMany({
    where: { conversationId: id, ...(cursorDate ? { createdAt: { lt: cursorDate } } : {}) },
    orderBy: { createdAt: 'desc' },
    take: PAGE_SIZE + 1,
    include: MESSAGE_INCLUDE,
  });
  const hasMore = rows.length > PAGE_SIZE;
  const page = rows.slice(0, PAGE_SIZE).reverse();

  return NextResponse.json(
    { messages: page.map(serializeMessage), hasMore },
    { headers: { 'Cache-Control': 'no-store' } }
  );
});

/** POST { content, replyToId?, attachments? } */
export const POST = withTenantRoute(async (request, { session, companyId }, routeContext) => {
  const id = (await routeContext!.params).id;
  const access = await loadMembership(companyId, id, session.user.id);
  if (!access) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!canPost(access.conversation, access.member.role)) {
    return NextResponse.json(
      {
        error:
          access.conversation.type === 'BROADCAST'
            ? 'Only admins can post in this broadcast'
            : 'This conversation is archived',
      },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const content = typeof body.content === 'string' ? body.content.trim() : '';
  const attachments = normalizeAttachments(body.attachments);
  if (!content && attachments.length === 0) {
    return NextResponse.json({ error: 'Message is empty' }, { status: 400 });
  }
  if (content.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: `Messages are limited to ${MAX_MESSAGE_LENGTH.toLocaleString()} characters` },
      { status: 400 }
    );
  }

  const message = await postMessage({
    companyId,
    conversation: access.conversation,
    sender: { id: session.user.id, name: session.user.name, email: session.user.email },
    content,
    replyToId: typeof body.replyToId === 'string' ? body.replyToId : null,
    attachments,
  });
  return jsonOk(serializeMessage(message), { status: 201 });
});
