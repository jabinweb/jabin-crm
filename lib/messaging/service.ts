import { NotificationType, type Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { publishRealtimeTo } from '@/lib/realtime/hub';
import { REALTIME_EVENTS } from '@/lib/realtime/events';
import { workspaceStaffWhere } from '@/lib/auth/workspace-staff';
import { notificationService } from '@/lib/crm/notification-service';
import { logError } from '@/lib/logger';
import { chatPlainText, extractChatMentionIds } from '@/lib/messaging/mentions';

export const CONVERSATION_TYPES = ['DIRECT', 'GROUP', 'BROADCAST'] as const;
export type ConversationType = (typeof CONVERSATION_TYPES)[number];
export type MemberRole = 'OWNER' | 'ADMIN' | 'MEMBER';

export const MAX_MESSAGE_LENGTH = 10_000;
export const MAX_ATTACHMENTS = 10;
export const REACTION_EMOJI = ['👍', '❤️', '😂', '🎉', '👀', '🙏', '✅', '🔥'] as const;

export const PERSON_SELECT = { id: true, name: true, email: true, image: true } as const;

export const MESSAGE_INCLUDE = {
  sender: { select: PERSON_SELECT },
  replyTo: {
    select: {
      id: true,
      content: true,
      deletedAt: true,
      sender: { select: { id: true, name: true, email: true } },
    },
  },
  reactions: { select: { emoji: true, userId: true } },
} as const;

type MessageRow = Prisma.ChatMessageGetPayload<{ include: typeof MESSAGE_INCLUDE }>;

export type ChatAttachment = { url: string; name: string; mimeType?: string | null; size?: number | null };

/** API shape of a message. Deleted messages keep their place but lose their content. */
export function serializeMessage(message: MessageRow) {
  const deleted = !!message.deletedAt;
  const reactions = new Map<string, string[]>();
  for (const r of message.reactions) {
    const list = reactions.get(r.emoji);
    if (list) list.push(r.userId);
    else reactions.set(r.emoji, [r.userId]);
  }
  return {
    id: message.id,
    conversationId: message.conversationId,
    kind: message.kind,
    content: deleted ? '' : message.content,
    attachments: deleted ? [] : ((message.attachments as ChatAttachment[] | null) ?? []),
    sender: message.sender,
    createdAt: message.createdAt,
    editedAt: message.editedAt,
    deletedAt: message.deletedAt,
    replyTo: message.replyTo
      ? {
          id: message.replyTo.id,
          sender: message.replyTo.sender,
          preview: message.replyTo.deletedAt
            ? 'Message deleted'
            : chatPlainText(message.replyTo.content).slice(0, 140),
        }
      : null,
    reactions: Array.from(reactions.entries()).map(([emoji, userIds]) => ({ emoji, userIds })),
  };
}

export type SerializedMessage = ReturnType<typeof serializeMessage>;

/** "<a>:<b>" with ids sorted, so a pair has exactly one DM per workspace. */
export function directKeyFor(a: string, b: string) {
  return [a, b].sort().join(':');
}

export function canManage(conversation: { type: string }, role?: string | null) {
  return conversation.type !== 'DIRECT' && (role === 'OWNER' || role === 'ADMIN');
}

export function canPost(conversation: { type: string; archivedAt?: Date | null }, role?: string | null) {
  if (conversation.archivedAt) return false;
  if (conversation.type === 'BROADCAST') return role === 'OWNER' || role === 'ADMIN';
  return true;
}

/** Workspace-wide conversations pick up new teammates the first time they look. */
export async function syncEveryoneMemberships(companyId: string, userId: string) {
  const missing = await prisma.conversation.findMany({
    where: {
      companyId,
      includesEveryone: true,
      archivedAt: null,
      members: { none: { userId } },
    },
    select: { id: true },
  });
  if (missing.length === 0) return;
  // Portal customers can resolve a workspace too — only staff join "everyone" conversations
  const staff = await prisma.user.findFirst({
    where: { id: userId, ...workspaceStaffWhere(companyId) },
    select: { id: true },
  });
  if (!staff) return;
  await prisma.conversationMember.createMany({
    data: missing.map((c: { id: string }) => ({ conversationId: c.id, userId, role: 'MEMBER' })),
    skipDuplicates: true,
  });
}

/** The conversation plus the caller's membership, or null when they are not in it. */
export async function loadMembership(companyId: string, conversationId: string, userId: string) {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, companyId },
  });
  if (!conversation) return null;
  let member = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
  if (!member && conversation.includesEveryone && !conversation.archivedAt) {
    const staff = await prisma.user.findFirst({
      where: { id: userId, ...workspaceStaffWhere(companyId) },
      select: { id: true },
    });
    if (staff) {
      member = await prisma.conversationMember.create({
        data: { conversationId, userId, role: 'MEMBER' },
      });
    }
  }
  if (!member) return null;
  return { conversation, member };
}

export async function memberIdsOf(conversationId: string): Promise<string[]> {
  const rows = await prisma.conversationMember.findMany({
    where: { conversationId },
    select: { userId: true },
  });
  return rows.map((r: { userId: string }) => r.userId);
}

/** Tell members' open tabs something changed. Ids only — clients refetch through the API. */
export async function publishConversationChange(params: {
  companyId: string;
  conversationId: string;
  change: 'message' | 'edit' | 'delete' | 'reaction' | 'read' | 'members' | 'details';
  actorId?: string;
  messageId?: string;
  audience?: string[];
}) {
  const audience = params.audience ?? (await memberIdsOf(params.conversationId));
  await publishRealtimeTo(
    REALTIME_EVENTS.CONVERSATION_UPDATED,
    params.companyId,
    audience,
    {
      conversationId: params.conversationId,
      change: params.change,
      messageId: params.messageId ?? null,
      actorId: params.actorId ?? null,
    },
    params.actorId
  ).catch(() => undefined);
}

export async function postSystemMessage(conversationId: string, content: string) {
  return prisma.chatMessage.create({
    data: { conversationId, senderId: null, kind: 'SYSTEM', content },
  });
}

export async function findOrCreateDirect(companyId: string, a: string, b: string) {
  const directKey = directKeyFor(a, b);
  const existing = await prisma.conversation.findUnique({
    where: { companyId_directKey: { companyId, directKey } },
  });
  if (existing) return existing;
  try {
    return await prisma.conversation.create({
      data: {
        companyId,
        type: 'DIRECT',
        directKey,
        createdById: a,
        members: {
          create: [
            { userId: a, role: 'MEMBER' },
            { userId: b, role: 'MEMBER' },
          ],
        },
      },
    });
  } catch {
    // Created concurrently by the other person
    return prisma.conversation.findUniqueOrThrow({
      where: { companyId_directKey: { companyId, directKey } },
    });
  }
}

export function normalizeAttachments(raw: unknown): ChatAttachment[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (a): a is Record<string, unknown> =>
        !!a && typeof a === 'object' && typeof (a as { url?: unknown }).url === 'string'
    )
    .filter((a) => /^(https?:\/\/|\/(?!\/))/i.test(String(a.url)))
    .slice(0, MAX_ATTACHMENTS)
    .map((a) => ({
      url: String(a.url),
      name: typeof a.name === 'string' && a.name.trim() ? a.name.trim().slice(0, 200) : 'File',
      mimeType: typeof a.mimeType === 'string' ? a.mimeType.slice(0, 120) : null,
      size: typeof a.size === 'number' && Number.isFinite(a.size) ? a.size : null,
    }));
}

/**
 * Write a message and fan it out: unread state, realtime refresh, and notifications
 * (direct messages, broadcasts and @mentions — not every group message).
 */
export async function postMessage(params: {
  companyId: string;
  conversation: { id: string; type: string; name: string | null };
  sender: { id: string; name?: string | null; email?: string | null };
  content: string;
  replyToId?: string | null;
  attachments?: ChatAttachment[];
}) {
  const now = new Date();
  let replyToId: string | null = null;
  if (params.replyToId) {
    const parent = await prisma.chatMessage.findFirst({
      where: { id: params.replyToId, conversationId: params.conversation.id },
      select: { id: true },
    });
    replyToId = parent?.id ?? null;
  }

  const [message] = await prisma.$transaction([
    prisma.chatMessage.create({
      data: {
        conversationId: params.conversation.id,
        senderId: params.sender.id,
        content: params.content,
        replyToId,
        ...(params.attachments?.length
          ? { attachments: params.attachments as unknown as Prisma.InputJsonValue }
          : {}),
      },
      include: MESSAGE_INCLUDE,
    }),
    prisma.conversation.update({
      where: { id: params.conversation.id },
      data: { lastMessageAt: now },
    }),
    prisma.conversationMember.update({
      where: {
        conversationId_userId: { conversationId: params.conversation.id, userId: params.sender.id },
      },
      data: { lastReadAt: now },
    }),
  ]);

  const members = await prisma.conversationMember.findMany({
    where: { conversationId: params.conversation.id },
    select: { userId: true, mutedAt: true },
  });
  const memberIds = members.map((m: { userId: string }) => m.userId);

  await publishConversationChange({
    companyId: params.companyId,
    conversationId: params.conversation.id,
    change: 'message',
    actorId: params.sender.id,
    messageId: message.id,
    audience: memberIds,
  });

  void notifyRecipients({
    companyId: params.companyId,
    conversation: params.conversation,
    sender: params.sender,
    content: params.content,
    members,
  });

  return message;
}

async function notifyRecipients(params: {
  companyId: string;
  conversation: { id: string; type: string; name: string | null };
  sender: { id: string; name?: string | null; email?: string | null };
  content: string;
  members: Array<{ userId: string; mutedAt: Date | null }>;
}) {
  try {
    const senderName = params.sender.name || params.sender.email || 'A teammate';
    const mentioned = new Set(extractChatMentionIds(params.content));
    const preview = chatPlainText(params.content).slice(0, 200) || 'Sent an attachment';

    const recipients = params.members
      .filter((m) => m.userId !== params.sender.id)
      .filter((m) => {
        if (mentioned.has(m.userId)) return true; // mentions break through mute
        if (m.mutedAt) return false;
        return params.conversation.type === 'DIRECT' || params.conversation.type === 'BROADCAST';
      })
      .map((m) => m.userId);
    if (recipients.length === 0) return;

    // One unread chat notification per conversation is enough — the thread shows the rest
    const alreadyPending = await prisma.notification.findMany({
      where: {
        userId: { in: recipients },
        type: NotificationType.CHAT_MESSAGE,
        read: false,
        metadata: { path: ['conversationId'], equals: params.conversation.id },
      },
      select: { userId: true },
    });
    const skip = new Set(alreadyPending.map((n: { userId: string | null }) => n.userId));

    const where = params.conversation.name ? ` in ${params.conversation.name}` : '';
    await Promise.all(
      recipients
        .filter((userId) => mentioned.has(userId) || !skip.has(userId))
        .map((userId) =>
          notificationService.create({
            type: NotificationType.CHAT_MESSAGE,
            userId,
            title: mentioned.has(userId)
              ? `${senderName} mentioned you${where}`
              : params.conversation.type === 'BROADCAST'
                ? `New announcement${where}`
                : `Message from ${senderName}`,
            body: preview,
            metadata: {
              companyId: params.companyId,
              conversationId: params.conversation.id,
              href: `/dashboard/messages?c=${params.conversation.id}`,
            },
          })
        )
    );
  } catch (error) {
    logError(error, { context: 'messaging: notifications failed' });
  }
}

/** Unread count across the caller's conversations in a workspace. */
export async function unreadTotal(companyId: string, userId: string) {
  const memberships = await prisma.conversationMember.findMany({
    where: { userId, conversation: { companyId, archivedAt: null } },
    select: { conversationId: true, lastReadAt: true },
  });
  if (memberships.length === 0) return 0;
  const counts = await Promise.all(
    memberships.map((m: { conversationId: string; lastReadAt: Date | null }) =>
      prisma.chatMessage.count({
        where: {
          conversationId: m.conversationId,
          deletedAt: null,
          kind: 'TEXT',
          senderId: { not: userId },
          ...(m.lastReadAt ? { createdAt: { gt: m.lastReadAt } } : {}),
        },
      })
    )
  );
  return counts.reduce((sum, n) => sum + n, 0);
}

/** Send a direct message on someone's behalf (used by the ops agent). */
export async function sendDirectMessage(params: {
  companyId: string;
  sender: { id: string; name?: string | null; email?: string | null };
  recipientId: string;
  content: string;
}) {
  const recipient = await prisma.user.findFirst({
    where: { id: params.recipientId, ...workspaceStaffWhere(params.companyId) },
    select: { id: true },
  });
  if (!recipient) throw new Error('That person is not in this workspace');
  const conversation = await findOrCreateDirect(params.companyId, params.sender.id, params.recipientId);
  return postMessage({
    companyId: params.companyId,
    conversation,
    sender: params.sender,
    content: params.content.slice(0, MAX_MESSAGE_LENGTH),
  });
}
