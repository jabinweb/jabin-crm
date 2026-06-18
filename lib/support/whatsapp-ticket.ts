import { prisma } from '@/lib/prisma';
import { createPortalTicket } from '@/lib/support/create-portal-ticket';

/** Create or link a support ticket from an inbound WhatsApp message. */
export async function ensureWhatsAppTicket(params: {
  userId: string;
  fromPhone: string;
  message: string;
  messageLogId: string;
}) {
  const phone = params.fromPhone.replace(/^whatsapp:/, '').trim();
  if (!phone) return null;

  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { companyId: true, primaryCompanyId: true },
  });
  const companyId = user?.primaryCompanyId ?? user?.companyId;
  if (!companyId) return null;

  let customer = await prisma.customer.findFirst({
    where: {
      companyId,
      OR: [{ phone: { contains: phone.slice(-10) } }, { email: { contains: '@' } }],
    },
    select: { id: true },
  });

  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        organizationName: `WhatsApp ${phone}`,
        contactPerson: phone,
        phone,
        email: `${phone.replace(/\D/g, '')}@whatsapp.local`,
        companyId,
      },
      select: { id: true },
    });
  }

  const existingTicket = await prisma.supportTicket.findFirst({
    where: {
      customerId: customer.id,
      channel: 'WHATSAPP',
      status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] },
    },
    select: { id: true },
    orderBy: { createdAt: 'desc' },
  });

  if (existingTicket) {
    await prisma.whatsAppMessage.update({
      where: { id: params.messageLogId },
      data: { ticketId: existingTicket.id, customerId: customer.id },
    });
    await prisma.ticketActivity.create({
      data: {
        ticketId: existingTicket.id,
        eventType: 'COMMENT',
        description: `[WhatsApp] ${params.message}`,
        metadata: { whatsappMessageId: params.messageLogId },
      },
    });
    return existingTicket.id;
  }

  const ticket = await createPortalTicket(customer.id, {
    ticketType: 'general',
    subject: `WhatsApp: ${params.message.slice(0, 60)}`,
    description: params.message,
    priority: 'MEDIUM',
  });

  await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: { channel: 'WHATSAPP' },
  });

  await prisma.whatsAppMessage.update({
    where: { id: params.messageLogId },
    data: { ticketId: ticket.id, customerId: customer.id },
  });

  return ticket.id;
}
