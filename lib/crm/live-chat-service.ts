import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { ticketService } from '@/lib/crm/ticket-service';
import { publishRealtime } from '@/lib/realtime/hub';
import { REALTIME_EVENTS } from '@/lib/realtime/events';

export async function getOrCreateChatSession(params: {
  visitorToken?: string;
  visitorName?: string;
  visitorEmail?: string;
  customerId?: string;
  companyId?: string;
}) {
  const visitorToken = params.visitorToken || randomUUID();

  let session = params.visitorToken
    ? await prisma.liveChatSession.findUnique({
        where: { visitorToken: params.visitorToken },
        include: { messages: { orderBy: { createdAt: 'asc' }, take: 100 } },
      })
    : null;

  if (!session) {
    session = await prisma.liveChatSession.create({
      data: {
        visitorToken,
        visitorName: params.visitorName,
        visitorEmail: params.visitorEmail,
        customerId: params.customerId,
        companyId: params.companyId,
        status: 'OPEN',
      },
      include: { messages: true },
    });
    if (params.companyId) {
      void publishRealtime(REALTIME_EVENTS.CHAT_SESSION, params.companyId, {
        sessionId: session.id,
        status: 'OPEN',
      });
    }
  }

  return session;
}

export async function addChatMessage(params: {
  sessionId: string;
  sender: 'visitor' | 'agent';
  senderId?: string;
  body: string;
}) {
  const message = await prisma.liveChatMessage.create({
    data: {
      sessionId: params.sessionId,
      sender: params.sender,
      senderId: params.senderId,
      body: params.body,
    },
  });

  const session = await prisma.liveChatSession.findUnique({
    where: { id: params.sessionId },
  });

  if (!session) return message;

  if (session.companyId) {
    void publishRealtime(REALTIME_EVENTS.CHAT_MESSAGE, session.companyId, {
      sessionId: session.id,
      messageId: message.id,
      sender: params.sender,
      preview: params.body.slice(0, 120),
    });
  }

  if (!session.ticketId && params.sender === 'visitor') {
    let customerId = session.customerId;

    if (!customerId && session.visitorEmail) {
      const customer = await prisma.customer.findFirst({
        where: { email: { equals: session.visitorEmail, mode: 'insensitive' } },
      });
      customerId = customer?.id;
    }

    if (customerId) {
      const ticket = await ticketService.createTicket({
        customerId,
        subject: `Live chat — ${session.visitorName || 'Visitor'}`,
        description: params.body,
        channel: 'CHAT',
        priority: 'MEDIUM',
      });

      await prisma.liveChatSession.update({
        where: { id: session.id },
        data: { ticketId: ticket.id, customerId },
      });

      await ticketService.addComment(
        ticket.id,
        params.body,
        params.senderId || 'system',
        { isInternal: false }
      );
    }
  } else if (session.ticketId) {
    await ticketService.addComment(
      session.ticketId,
      params.body,
      params.senderId || 'system',
      { isInternal: params.sender === 'agent' ? false : false }
    );
  }

  return message;
}

export async function listOpenChatSessions(companyId?: string) {
  return prisma.liveChatSession.findMany({
    where: {
      status: 'OPEN',
      ...(companyId ? { companyId } : {}),
    },
    include: {
      messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      customer: { select: { organizationName: true, contactPerson: true } },
      ticket: { select: { id: true, subject: true, status: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  });
}
