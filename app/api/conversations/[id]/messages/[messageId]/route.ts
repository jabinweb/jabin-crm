import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';
import {
  MAX_MESSAGE_LENGTH,
  MESSAGE_INCLUDE,
  REACTION_EMOJI,
  canManage,
  loadMembership,
  publishConversationChange,
  serializeMessage,
} from '@/lib/messaging/service';

async function loadMessage(companyId: string, conversationId: string, messageId: string, userId: string) {
  const access = await loadMembership(companyId, conversationId, userId);
  if (!access) return null;
  const message = await prisma.chatMessage.findFirst({
    where: { id: messageId, conversationId },
  });
  if (!message) return null;
  return { ...access, message };
}

/** PATCH { content } — edit your own message. */
export const PATCH = withTenantRoute(async (request, { session, companyId }, routeContext) => {
  const { id, messageId } = await routeContext!.params;
  const found = await loadMessage(companyId, id, messageId, session.user.id);
  if (!found) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (found.message.senderId !== session.user.id || found.message.kind !== 'TEXT') {
    return NextResponse.json({ error: 'You can only edit your own messages' }, { status: 403 });
  }
  if (found.message.deletedAt) {
    return NextResponse.json({ error: 'This message was deleted' }, { status: 400 });
  }
  const body = await request.json().catch(() => ({}));
  const content = typeof body.content === 'string' ? body.content.trim() : '';
  if (!content) return NextResponse.json({ error: 'Message is empty' }, { status: 400 });
  if (content.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ error: 'Message is too long' }, { status: 400 });
  }

  const updated = await prisma.chatMessage.update({
    where: { id: messageId },
    data: { content, editedAt: new Date() },
    include: MESSAGE_INCLUDE,
  });
  await publishConversationChange({ companyId, conversationId: id, change: 'edit', actorId: session.user.id, messageId });
  return jsonOk(serializeMessage(updated));
});

/** POST { emoji } — toggle your reaction. */
export const POST = withTenantRoute(async (request, { session, companyId }, routeContext) => {
  const { id, messageId } = await routeContext!.params;
  const found = await loadMessage(companyId, id, messageId, session.user.id);
  if (!found || found.message.deletedAt) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const body = await request.json().catch(() => ({}));
  const emoji = typeof body.emoji === 'string' ? body.emoji : '';
  if (!(REACTION_EMOJI as readonly string[]).includes(emoji)) {
    return NextResponse.json({ error: 'Unsupported reaction' }, { status: 400 });
  }

  const key = { messageId_userId_emoji: { messageId, userId: session.user.id, emoji } };
  const existing = await prisma.chatMessageReaction.findUnique({ where: key });
  if (existing) await prisma.chatMessageReaction.delete({ where: key });
  else await prisma.chatMessageReaction.create({ data: { messageId, userId: session.user.id, emoji } });

  const updated = await prisma.chatMessage.findUniqueOrThrow({
    where: { id: messageId },
    include: MESSAGE_INCLUDE,
  });
  await publishConversationChange({ companyId, conversationId: id, change: 'reaction', actorId: session.user.id, messageId });
  return jsonOk(serializeMessage(updated));
});

/** DELETE — remove your own message; owners/admins can remove anyone's in groups. */
export const DELETE = withTenantRoute(async (_request, { session, companyId }, routeContext) => {
  const { id, messageId } = await routeContext!.params;
  const found = await loadMessage(companyId, id, messageId, session.user.id);
  if (!found) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const own = found.message.senderId === session.user.id;
  if (!own && !canManage(found.conversation, found.member.role)) {
    return NextResponse.json({ error: 'You can only delete your own messages' }, { status: 403 });
  }
  if (found.message.kind !== 'TEXT') {
    return NextResponse.json({ error: 'System messages cannot be deleted' }, { status: 400 });
  }

  const updated = await prisma.chatMessage.update({
    where: { id: messageId },
    data: { deletedAt: new Date(), content: '', attachments: [] },
    include: MESSAGE_INCLUDE,
  });
  await prisma.chatMessageReaction.deleteMany({ where: { messageId } });
  await publishConversationChange({ companyId, conversationId: id, change: 'delete', actorId: session.user.id, messageId });
  return jsonOk(serializeMessage(updated));
});
