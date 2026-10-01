import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';
import { hasLegacyRole } from '@/lib/auth/permissions';
import { workspaceStaffWhere } from '@/lib/auth/workspace-staff';
import { chatPlainText } from '@/lib/messaging/mentions';
import {
  PERSON_SELECT,
  findOrCreateDirect,
  postSystemMessage,
  publishConversationChange,
  syncEveryoneMemberships,
} from '@/lib/messaging/service';

type Person = { id: string; name: string | null; email: string; image: string | null };

/** GET /api/conversations — the caller's conversations in this workspace, newest activity first. */
export const GET = withTenantRoute(async (_request, { session, companyId }) => {
  const me = session.user.id;
  await syncEveryoneMemberships(companyId, me);
  // Presence for the Messages page ("Active now"), at most once a minute
  await prisma.user.updateMany({
    where: { id: me, OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: new Date(Date.now() - 60_000) } }] },
    data: { lastSeenAt: new Date() },
  });

  const memberships = await prisma.conversationMember.findMany({
    where: { userId: me, conversation: { companyId, archivedAt: null } },
    include: {
      conversation: {
        include: {
          members: {
            take: 6,
            orderBy: { joinedAt: 'asc' },
            include: { user: { select: PERSON_SELECT } },
          },
          _count: { select: { members: true } },
          messages: {
            where: { deletedAt: null },
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              content: true,
              kind: true,
              createdAt: true,
              attachments: true,
              sender: { select: { id: true, name: true, email: true } },
            },
          },
        },
      },
    },
  });

  const rows = await Promise.all(
    memberships.map(async (m: (typeof memberships)[number]) => {
      const c = m.conversation;
      const unreadCount = await prisma.chatMessage.count({
        where: {
          conversationId: c.id,
          deletedAt: null,
          kind: 'TEXT',
          senderId: { not: me },
          ...(m.lastReadAt ? { createdAt: { gt: m.lastReadAt } } : {}),
        },
      });
      const people = c.members.map((x: { user: Person }) => x.user);
      const other = c.type === 'DIRECT' ? people.find((p: Person) => p.id !== me) ?? null : null;
      const last = c.messages[0];
      return {
        id: c.id,
        type: c.type,
        name: c.type === 'DIRECT' ? other?.name || other?.email || 'Direct message' : c.name,
        description: c.description,
        includesEveryone: c.includesEveryone,
        projectId: c.projectId,
        otherUser: other,
        members: people.filter((p: Person) => p.id !== me).slice(0, 4),
        memberCount: c._count.members,
        myRole: m.role,
        muted: !!m.mutedAt,
        unreadCount,
        lastMessageAt: c.lastMessageAt ?? c.createdAt,
        lastMessage: last
          ? {
              preview:
                last.kind === 'SYSTEM'
                  ? last.content
                  : chatPlainText(last.content).slice(0, 120) ||
                    (Array.isArray(last.attachments) && last.attachments.length ? '📎 Attachment' : ''),
              senderName:
                last.kind === 'SYSTEM'
                  ? null
                  : last.sender?.id === me
                    ? 'You'
                    : last.sender?.name || last.sender?.email || null,
              createdAt: last.createdAt,
            }
          : null,
      };
    })
  );

  rows.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
  return NextResponse.json({ conversations: rows }, { headers: { 'Cache-Control': 'no-store' } });
});

/**
 * POST /api/conversations
 *  { type: 'DIRECT', userId }                                   → open (or reuse) a DM
 *  { type: 'GROUP' | 'BROADCAST', name, description?, memberIds?, includesEveryone? }
 */
export const POST = withTenantRoute(async (request, { session, companyId }) => {
  const me = session.user.id;
  const body = await request.json().catch(() => ({}));
  const type = body.type;

  if (type === 'DIRECT') {
    const otherId = typeof body.userId === 'string' ? body.userId : '';
    if (!otherId || otherId === me) {
      return NextResponse.json({ error: 'Pick someone to message' }, { status: 400 });
    }
    const other = await prisma.user.findFirst({
      where: { id: otherId, userStatus: 'ACTIVE', ...workspaceStaffWhere(companyId) },
      select: { id: true },
    });
    if (!other) {
      return NextResponse.json({ error: 'That person is not in this workspace' }, { status: 404 });
    }
    const conversation = await findOrCreateDirect(companyId, me, otherId);
    return jsonOk({ id: conversation.id }, { status: 201 });
  }

  if (type !== 'GROUP' && type !== 'BROADCAST') {
    return NextResponse.json({ error: 'Unknown conversation type' }, { status: 400 });
  }
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : '';
  if (!name) return NextResponse.json({ error: 'Give it a name' }, { status: 400 });

  const includesEveryone = body.includesEveryone === true;
  if (includesEveryone && !hasLegacyRole(session, 'ADMIN', 'SUPER_ADMIN')) {
    return NextResponse.json(
      { error: 'Only workspace admins can create a conversation for everyone' },
      { status: 403 }
    );
  }

  const requested = Array.isArray(body.memberIds)
    ? body.memberIds.filter((id: unknown): id is string => typeof id === 'string')
    : [];
  const staff = await prisma.user.findMany({
    where: {
      userStatus: 'ACTIVE',
      ...workspaceStaffWhere(companyId),
      ...(includesEveryone ? {} : { id: { in: requested } }),
    },
    select: { id: true },
  });
  const memberIds = Array.from(new Set([...staff.map((s: { id: string }) => s.id), me]));

  const description =
    typeof body.description === 'string' ? body.description.trim().slice(0, 300) || null : null;
  let projectId: string | null = null;
  if (typeof body.projectId === 'string' && body.projectId) {
    const project = await prisma.project.findFirst({
      where: { id: body.projectId, companyId },
      select: { id: true },
    });
    projectId = project?.id ?? null;
  }

  const conversation = await prisma.conversation.create({
    data: {
      companyId,
      type,
      name,
      description,
      includesEveryone,
      projectId,
      createdById: me,
      lastMessageAt: new Date(),
      members: {
        create: memberIds.map((userId) => ({
          userId,
          role: userId === me ? 'OWNER' : 'MEMBER',
          ...(userId === me ? { lastReadAt: new Date() } : {}),
        })),
      },
    },
  });

  const actor = session.user.name || session.user.email || 'Someone';
  await postSystemMessage(
    conversation.id,
    type === 'BROADCAST'
      ? `${actor} created this broadcast. Only admins can post here.`
      : `${actor} created ${name}.`
  );
  await publishConversationChange({
    companyId,
    conversationId: conversation.id,
    change: 'members',
    actorId: me,
    audience: memberIds,
  });

  return jsonOk({ id: conversation.id }, { status: 201 });
});
