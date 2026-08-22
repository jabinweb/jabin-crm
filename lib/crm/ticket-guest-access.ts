import { randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'

export function generateGuestAccessToken(): string {
  return randomBytes(24).toString('hex')
}

export async function ensureTicketGuestToken(ticketId: string): Promise<string> {
  const existing = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: { guestAccessToken: true },
  })
  if (existing?.guestAccessToken) return existing.guestAccessToken
  const token = generateGuestAccessToken()
  await prisma.supportTicket.update({
    where: { id: ticketId },
    data: { guestAccessToken: token },
  })
  return token
}

export async function revokeTicketGuestToken(ticketId: string): Promise<void> {
  await prisma.supportTicket.update({
    where: { id: ticketId },
    data: { guestAccessToken: null },
  })
}

export async function rotateTicketGuestToken(ticketId: string): Promise<string> {
  const token = generateGuestAccessToken()
  await prisma.supportTicket.update({
    where: { id: ticketId },
    data: { guestAccessToken: token },
  })
  return token
}

export async function resolveTicketByGuestToken(token: string) {
  if (!token || token.length < 16) return null
  return prisma.supportTicket.findFirst({
    where: { guestAccessToken: token },
    include: {
      customer: { select: { id: true, organizationName: true, companyId: true, email: true } },
      activities: {
        where: { isInternal: false },
        orderBy: { createdAt: 'asc' },
        take: 100,
      },
      attachments: true,
    },
  })
}
