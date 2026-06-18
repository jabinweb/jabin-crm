import { prisma } from '@/lib/prisma';

export type InboxItemType = 'ticket' | 'chat' | 'whatsapp';

export interface UnifiedInboxItem {
  id: string;
  type: InboxItemType;
  channel: string;
  subject: string;
  preview: string;
  customerName: string;
  customerId?: string;
  status: string;
  priority?: string;
  agentName?: string;
  ticketId?: string;
  updatedAt: string;
  unread?: boolean;
}

export async function buildUnifiedInbox(options: {
  companyId?: string;
  channel?: string;
  limit?: number;
}) {
  const { companyId, channel, limit = 100 } = options;

  const ticketWhere: Record<string, unknown> = { mergedIntoId: null };
  if (companyId) {
    ticketWhere.customer = { companyId };
  }
  if (channel && channel !== 'all' && channel !== 'CHAT') {
    ticketWhere.channel = channel;
  }

  const [tickets, chatSessions, whatsappMessages] = await Promise.all([
    channel === 'CHAT'
      ? []
      : prisma.supportTicket.findMany({
          where: ticketWhere,
          include: {
            customer: { select: { id: true, organizationName: true } },
            assignedTechnician: { select: { name: true } },
          },
          orderBy: { updatedAt: 'desc' },
          take: limit,
        }),
    channel === 'all' || channel === 'CHAT'
      ? prisma.liveChatSession.findMany({
          where: {
            status: { in: ['OPEN', 'ACTIVE', 'WAITING'] },
            ...(companyId ? { companyId } : {}),
          },
          include: {
            ticket: { select: { id: true, subject: true, status: true, priority: true } },
            messages: { orderBy: { createdAt: 'desc' }, take: 1 },
          },
          orderBy: { updatedAt: 'desc' },
          take: 50,
        })
      : [],
    channel === 'all' || channel === 'WHATSAPP'
      ? prisma.whatsAppMessage.findMany({
          where: {
            direction: 'INBOUND',
            ...(companyId
              ? {
                  OR: [
                    { customer: { companyId } },
                    { ticket: { customer: { companyId } } },
                  ],
                }
              : {}),
          },
          include: {
            customer: { select: { id: true, organizationName: true } },
            ticket: {
              select: {
                id: true,
                subject: true,
                status: true,
                priority: true,
                assignedTechnician: { select: { name: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        })
      : [],
  ]);

  const items: UnifiedInboxItem[] = [];

  for (const t of tickets) {
    items.push({
      id: t.id,
      type: 'ticket',
      channel: t.channel,
      subject: t.subject,
      preview: t.description.slice(0, 120),
      customerName: t.customer.organizationName,
      customerId: t.customer.id,
      status: t.status,
      priority: t.priority,
      agentName: t.assignedTechnician?.name,
      ticketId: t.id,
      updatedAt: t.updatedAt.toISOString(),
    });
  }

  for (const s of chatSessions) {
    items.push({
      id: s.id,
      type: 'chat',
      channel: 'CHAT',
      subject: s.ticket?.subject ?? `Live chat — ${s.visitorName ?? 'Visitor'}`,
      preview: s.messages[0]?.body?.slice(0, 120) ?? 'No messages yet',
      customerName: s.visitorName ?? s.visitorEmail ?? 'Visitor',
      status: s.status,
      ticketId: s.ticket?.id,
      updatedAt: s.updatedAt.toISOString(),
      unread: s.status === 'WAITING',
    });
  }

  for (const m of whatsappMessages) {
    if (items.some((i) => i.ticketId && i.ticketId === m.ticketId)) continue;
    if (m.ticket) {
      items.push({
        id: m.id,
        type: 'whatsapp',
        channel: 'WHATSAPP',
        subject: m.ticket.subject,
        preview: m.message.slice(0, 120),
        customerName: m.customer?.organizationName ?? m.fromPhone ?? 'WhatsApp',
        customerId: m.customer?.id,
        status: m.ticket.status,
        priority: m.ticket.priority,
        agentName: m.ticket.assignedTechnician?.name,
        ticketId: m.ticket.id,
        updatedAt: m.createdAt.toISOString(),
      });
    } else {
      items.push({
        id: m.id,
        type: 'whatsapp',
        channel: 'WHATSAPP',
        subject: `WhatsApp from ${m.fromPhone ?? 'unknown'}`,
        preview: m.message.slice(0, 120),
        customerName: m.fromPhone ?? 'WhatsApp',
        status: 'OPEN',
        updatedAt: m.createdAt.toISOString(),
        unread: true,
      });
    }
  }

  items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const channelCounts = {
    all: items.length,
    EMAIL: items.filter((i) => i.channel === 'EMAIL').length,
    CHAT: items.filter((i) => i.channel === 'CHAT').length,
    PORTAL: items.filter((i) => i.channel === 'PORTAL').length,
    PHONE: items.filter((i) => i.channel === 'PHONE').length,
    WHATSAPP: items.filter((i) => i.channel === 'WHATSAPP').length,
  };

  return { items: items.slice(0, limit), channelCounts };
}
