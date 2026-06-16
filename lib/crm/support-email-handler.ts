import { prisma } from '@/lib/prisma';
import { ticketService } from '@/lib/crm/ticket-service';
import { TicketChannel, TicketStatus } from '@prisma/client';

export type InboundEmailPayload = {
  from: string;
  to?: string;
  subject: string;
  textBody: string;
  htmlBody?: string;
  inReplyTo?: string;
  messageId?: string;
};

function extractTicketIdFromSubject(subject: string): string | null {
  const bracket = subject.match(/\[#([a-z0-9]{6,})\]/i);
  if (bracket) return bracket[1];
  const explicit = subject.match(/ticket[#:\s-]*([a-z0-9]{20,})/i);
  if (explicit) return explicit[1];
  return null;
}

async function findCustomerByEmail(email: string) {
  const normalized = email.toLowerCase().trim();
  return prisma.customer.findFirst({
    where: {
      OR: [
        { email: { equals: normalized, mode: 'insensitive' } },
        {
          contacts: {
            some: { email: { equals: normalized, mode: 'insensitive' } },
          },
        },
      ],
    },
  });
}

async function findOpenTicketForCustomer(customerId: string, subject: string) {
  const ticketIdHint = extractTicketIdFromSubject(subject);
  if (ticketIdHint) {
    const byId = await prisma.supportTicket.findFirst({
      where: {
        id: { contains: ticketIdHint, mode: 'insensitive' },
        customerId,
        status: { notIn: [TicketStatus.CLOSED] },
      },
    });
    if (byId) return byId;
  }

  const normalizedSubject = subject.replace(/^(re:\s*)+/i, '').trim();
  return prisma.supportTicket.findFirst({
    where: {
      customerId,
      status: { notIn: [TicketStatus.CLOSED] },
      subject: { equals: normalizedSubject, mode: 'insensitive' },
    },
    orderBy: { updatedAt: 'desc' },
  });
}

/** Route inbound email into the support desk (email channel). */
export async function handleSupportInboundEmail(payload: InboundEmailPayload) {
  const { from, subject, textBody, htmlBody } = payload;
  const body = (textBody || htmlBody || '').trim();
  if (!from || !subject) {
    return { handled: false as const, reason: 'missing_fields' };
  }

  const customer = await findCustomerByEmail(from);
  if (!customer) {
    return { handled: false as const, reason: 'unknown_customer' };
  }

  const existing = await findOpenTicketForCustomer(customer.id, subject);

  if (existing) {
    await ticketService.logActivity(
      existing.id,
      'EMAIL_REPLY',
      body.slice(0, 4000) || '(empty email body)',
      undefined,
      { from, channel: TicketChannel.EMAIL },
      false,
    );

    await prisma.supportTicket.update({
      where: { id: existing.id },
      data: { updatedAt: new Date(), channel: TicketChannel.EMAIL },
    });

    return { handled: true as const, action: 'reply' as const, ticketId: existing.id };
  }

  const ticket = await ticketService.createTicket({
    customerId: customer.id,
    subject: subject.replace(/^(re:\s*)+/i, '').slice(0, 500),
    description: body.slice(0, 8000) || 'Email received with no body.',
    priority: 'MEDIUM',
  });

  await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: { channel: TicketChannel.EMAIL },
  });

  return { handled: true as const, action: 'created' as const, ticketId: ticket.id };
}
