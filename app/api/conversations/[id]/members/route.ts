import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';
import { workspaceStaffWhere } from '@/lib/auth/workspace-staff';
import {
  canManage,
  loadMembership,
  memberIdsOf,
  postSystemMessage,
  publishConversationChange,
} from '@/lib/messaging/service';

function nameOf(user: { name: string | null; email: string }) {
  return user.name || user.email;
}

/** POST { userIds } — add people (owners & admins). */
export const POST = withTenantRoute(async (request, { session, companyId }, routeContext) => {
  const id = (await routeContext!.params).id;
  const access = await loadMembership(companyId, id, session.user.id);
  if (!access) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!canManage(access.conversation, access.member.role)) {
    return NextResponse.json({ error: 'Only owners and admins can add people' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const requested = Array.isArray(body.userIds)
    ? body.userIds.filter((u: unknown): u is string => typeof u === 'string')
    : [];
  const users = await prisma.user.findMany({
    where: {
      id: { in: requested },
      userStatus: 'ACTIVE',
      ...workspaceStaffWhere(companyId),
      conversationMemberships: { none: { conversationId: id } },
    },
    select: { id: true, name: true, email: true },
  });
  if (users.length === 0) return jsonOk({ added: 0 });

  await prisma.conversationMember.createMany({
    data: users.map((u: { id: string }) => ({ conversationId: id, userId: u.id, role: 'MEMBER' })),
    skipDuplicates: true,
  });
  const actor = session.user.name || session.user.email || 'Someone';
  await postSystemMessage(id, `${actor} added ${users.map(nameOf).join(', ')}.`);
  await publishConversationChange({ companyId, conversationId: id, change: 'members', actorId: session.user.id });
  return jsonOk({ added: users.length });
});

/** PATCH { userId, role } — promote/demote (owners & admins; only owners touch owners). */
export const PATCH = withTenantRoute(async (request, { session, companyId }, routeContext) => {
  const id = (await routeContext!.params).id;
  const access = await loadMembership(companyId, id, session.user.id);
  if (!access) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!canManage(access.conversation, access.member.role)) {
    return NextResponse.json({ error: 'Only owners and admins can change roles' }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  const role = body.role === 'ADMIN' || body.role === 'MEMBER' ? body.role : null;
  if (!role || typeof body.userId !== 'string') {
    return NextResponse.json({ error: 'userId and role (ADMIN or MEMBER) required' }, { status: 400 });
  }
  const target = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId: id, userId: body.userId } },
  });
  if (!target) return NextResponse.json({ error: 'Not a member' }, { status: 404 });
  if (target.role === 'OWNER') {
    return NextResponse.json({ error: 'The owner’s role cannot be changed' }, { status: 400 });
  }
  await prisma.conversationMember.update({
    where: { conversationId_userId: { conversationId: id, userId: body.userId } },
    data: { role },
  });
  await publishConversationChange({ companyId, conversationId: id, change: 'members', actorId: session.user.id });
  return jsonOk({ ok: true });
});

/** DELETE ?userId= — remove someone (owners & admins) or leave (yourself). */
export const DELETE = withTenantRoute(async (request, { session, companyId }, routeContext) => {
  const id = (await routeContext!.params).id;
  const access = await loadMembership(companyId, id, session.user.id);
  if (!access) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (access.conversation.type === 'DIRECT') {
    return NextResponse.json({ error: 'You cannot leave a direct message' }, { status: 400 });
  }

  const userId = new URL(request.url).searchParams.get('userId') || session.user.id;
  const leaving = userId === session.user.id;
  if (!leaving && !canManage(access.conversation, access.member.role)) {
    return NextResponse.json({ error: 'Only owners and admins can remove people' }, { status: 403 });
  }
  if (access.conversation.includesEveryone && !leaving) {
    return NextResponse.json(
      { error: 'Everyone in the workspace is in this conversation' },
      { status: 400 }
    );
  }

  const target = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId: id, userId } },
    include: { user: { select: { name: true, email: true } } },
  });
  if (!target) return NextResponse.json({ error: 'Not a member' }, { status: 404 });
  if (target.role === 'OWNER' && !leaving) {
    return NextResponse.json({ error: 'The owner cannot be removed' }, { status: 400 });
  }

  const audienceBefore = await memberIdsOf(id);
  await prisma.conversationMember.delete({
    where: { conversationId_userId: { conversationId: id, userId } },
  });

  // An owner leaving hands the conversation to the longest-standing admin, else member
  if (target.role === 'OWNER') {
    const heir = await prisma.conversationMember.findFirst({
      where: { conversationId: id },
      // 'ADMIN' sorts before 'MEMBER'; the owner row is already gone
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
    });
    if (heir) {
      await prisma.conversationMember.update({
        where: { conversationId_userId: { conversationId: id, userId: heir.userId } },
        data: { role: 'OWNER' },
      });
    }
  }

  const actor = session.user.name || session.user.email || 'Someone';
  await postSystemMessage(
    id,
    leaving ? `${actor} left.` : `${actor} removed ${nameOf(target.user)}.`
  );
  await publishConversationChange({
    companyId,
    conversationId: id,
    change: 'members',
    actorId: session.user.id,
    audience: audienceBefore,
  });
  return jsonOk({ ok: true });
});
