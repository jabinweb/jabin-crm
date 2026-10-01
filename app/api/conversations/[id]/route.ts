import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';
import {
  PERSON_SELECT,
  canManage,
  canPost,
  loadMembership,
  memberIdsOf,
  postSystemMessage,
  publishConversationChange,
} from '@/lib/messaging/service';

/** GET — details and full member list. */
export const GET = withTenantRoute(async (_request, { session, companyId }, routeContext) => {
  const id = (await routeContext!.params).id;
  const access = await loadMembership(companyId, id, session.user.id);
  if (!access) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { conversation, member } = access;

  const members = await prisma.conversationMember.findMany({
    where: { conversationId: id },
    orderBy: { joinedAt: 'asc' },
    include: { user: { select: { ...PERSON_SELECT, lastSeenAt: true } } },
  });
  const rank: Record<string, number> = { OWNER: 0, ADMIN: 1, MEMBER: 2 };
  members.sort(
    (a: { role: string }, b: { role: string }) => (rank[a.role] ?? 3) - (rank[b.role] ?? 3)
  );
  const other =
    conversation.type === 'DIRECT'
      ? members.find((m: { userId: string }) => m.userId !== session.user.id)?.user ?? null
      : null;

  return jsonOk({
    id: conversation.id,
    type: conversation.type,
    name:
      conversation.type === 'DIRECT' ? other?.name || other?.email || 'Direct message' : conversation.name,
    description: conversation.description,
    includesEveryone: conversation.includesEveryone,
    projectId: conversation.projectId,
    createdAt: conversation.createdAt,
    archivedAt: conversation.archivedAt,
    otherUser: other,
    myRole: member.role,
    muted: !!member.mutedAt,
    canManage: canManage(conversation, member.role),
    canPost: canPost(conversation, member.role),
    members: members.map((m: (typeof members)[number]) => ({ ...m.user, role: m.role })),
  });
});

/** PATCH — rename / describe / archive (owners & admins); mute is per person. */
export const PATCH = withTenantRoute(async (request, { session, companyId }, routeContext) => {
  const id = (await routeContext!.params).id;
  const access = await loadMembership(companyId, id, session.user.id);
  if (!access) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { conversation, member } = access;
  const body = await request.json().catch(() => ({}));

  if (typeof body.muted === 'boolean') {
    await prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId: id, userId: session.user.id } },
      data: { mutedAt: body.muted ? new Date() : null },
    });
  }

  const data: Record<string, unknown> = {};
  if (body.name !== undefined || body.description !== undefined || body.archived !== undefined) {
    if (!canManage(conversation, member.role)) {
      return NextResponse.json({ error: 'Only owners and admins can change this' }, { status: 403 });
    }
    if (typeof body.name === 'string') {
      const name = body.name.trim().slice(0, 80);
      if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
      if (name !== conversation.name) data.name = name;
    }
    if (typeof body.description === 'string') {
      data.description = body.description.trim().slice(0, 300) || null;
    }
    if (typeof body.archived === 'boolean') data.archivedAt = body.archived ? new Date() : null;
  }

  if (Object.keys(data).length > 0) {
    await prisma.conversation.update({ where: { id }, data });
    const actor = session.user.name || session.user.email || 'Someone';
    if (data.name) await postSystemMessage(id, `${actor} renamed this to ${data.name}.`);
    if (data.archivedAt) await postSystemMessage(id, `${actor} archived this conversation.`);
    await publishConversationChange({ companyId, conversationId: id, change: 'details', actorId: session.user.id });
  }
  return jsonOk({ ok: true });
});

/** DELETE — owners delete a group or broadcast with all its messages. */
export const DELETE = withTenantRoute(async (_request, { session, companyId }, routeContext) => {
  const id = (await routeContext!.params).id;
  const access = await loadMembership(companyId, id, session.user.id);
  if (!access) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (access.conversation.type === 'DIRECT' || access.member.role !== 'OWNER') {
    return NextResponse.json({ error: 'Only the owner can delete this' }, { status: 403 });
  }
  const audience = await memberIdsOf(id);
  await prisma.conversation.delete({ where: { id } });
  await publishConversationChange({ companyId, conversationId: id, change: 'details', actorId: session.user.id, audience });
  return jsonOk({ ok: true });
});
