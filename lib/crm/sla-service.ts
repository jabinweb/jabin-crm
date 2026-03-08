import { TicketPriority, TicketStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';

type SlaConfig = {
  responseHours: number;
  resolutionHours: number;
};

type SlaState = 'ON_TRACK' | 'AT_RISK' | 'BREACHED' | 'RESOLVED_ON_TIME' | 'RESOLVED_BREACHED';

type TicketWithActivities = {
  id: string;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: Date;
  updatedAt: Date;
  assignedTechnicianId: string | null;
  customerId: string;
  activities: Array<{
    eventType: string;
    createdAt: Date;
    description: string;
  }>;
};

export type TicketSlaStatus = {
  ticketId: string;
  subject: string;
  assignedTechnicianId: string | null;
  priority: TicketPriority;
  status: TicketStatus;
  state: SlaState;
  responseDueAt: Date;
  resolutionDueAt: Date;
  firstResponseAt: Date | null;
  resolvedAt: Date | null;
  responseBreached: boolean;
  resolutionBreached: boolean;
  responseRemainingMinutes: number;
  resolutionRemainingMinutes: number;
  responseTargetHours: number;
  resolutionTargetHours: number;
};

const SLA_BY_PRIORITY: Record<TicketPriority, SlaConfig> = {
  LOW: { responseHours: 8, resolutionHours: 72 },
  MEDIUM: { responseHours: 4, resolutionHours: 48 },
  HIGH: { responseHours: 2, resolutionHours: 24 },
  CRITICAL: { responseHours: 1, resolutionHours: 8 },
};

const ACTIVE_STATUSES: TicketStatus[] = ['OPEN', 'ASSIGNED', 'IN_PROGRESS'];
const ESCALATION_ROLES = ['SUPER_ADMIN', 'ADMIN', 'SUPPORT_MANAGER'] as const;

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function diffMinutes(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / (1000 * 60));
}

function isResolutionStatus(status: TicketStatus): boolean {
  return status === 'RESOLVED' || status === 'CLOSED';
}

function isFirstResponseEvent(eventType: string): boolean {
  if (eventType === 'CREATED') return false;
  return true;
}

function toSlaStatus(ticket: TicketWithActivities): TicketSlaStatus {
  const config = SLA_BY_PRIORITY[ticket.priority] || SLA_BY_PRIORITY.MEDIUM;
  const now = new Date();

  const responseDueAt = addHours(ticket.createdAt, config.responseHours);
  const resolutionDueAt = addHours(ticket.createdAt, config.resolutionHours);

  const firstResponseActivity = ticket.activities.find((activity) =>
    isFirstResponseEvent(activity.eventType)
  );
  const firstResponseAt = firstResponseActivity?.createdAt ?? null;

  const resolutionEvent = ticket.activities.find(
    (activity) =>
      activity.eventType === 'STATUS_CHANGED' &&
      (activity.description.includes('RESOLVED') || activity.description.includes('CLOSED'))
  );

  const resolvedAt = isResolutionStatus(ticket.status)
    ? resolutionEvent?.createdAt || ticket.updatedAt
    : null;

  const responseBreached = firstResponseAt
    ? firstResponseAt.getTime() > responseDueAt.getTime()
    : now.getTime() > responseDueAt.getTime();

  const resolutionBreached = resolvedAt
    ? resolvedAt.getTime() > resolutionDueAt.getTime()
    : !isResolutionStatus(ticket.status) && now.getTime() > resolutionDueAt.getTime();

  const responseRemainingMinutes = firstResponseAt
    ? diffMinutes(firstResponseAt, responseDueAt)
    : diffMinutes(now, responseDueAt);

  const resolutionRemainingMinutes = resolvedAt
    ? diffMinutes(resolvedAt, resolutionDueAt)
    : diffMinutes(now, resolutionDueAt);

  let state: SlaState = 'ON_TRACK';
  if (isResolutionStatus(ticket.status)) {
    state = resolutionBreached ? 'RESOLVED_BREACHED' : 'RESOLVED_ON_TIME';
  } else if (responseBreached || resolutionBreached) {
    state = 'BREACHED';
  } else {
    const responseTotal = config.responseHours * 60;
    const resolutionTotal = config.resolutionHours * 60;
    const responseAtRisk = !firstResponseAt && responseRemainingMinutes <= Math.max(30, responseTotal * 0.25);
    const resolutionAtRisk =
      resolutionRemainingMinutes <= Math.max(60, resolutionTotal * 0.25);
    if (responseAtRisk || resolutionAtRisk) {
      state = 'AT_RISK';
    }
  }

  return {
    ticketId: ticket.id,
    subject: ticket.subject,
    assignedTechnicianId: ticket.assignedTechnicianId,
    priority: ticket.priority,
    status: ticket.status,
    state,
    responseDueAt,
    resolutionDueAt,
    firstResponseAt,
    resolvedAt,
    responseBreached,
    resolutionBreached,
    responseRemainingMinutes,
    resolutionRemainingMinutes,
    responseTargetHours: config.responseHours,
    resolutionTargetHours: config.resolutionHours,
  };
}

export class SlaService {
  private async getTicketBase(ticketId: string): Promise<TicketWithActivities | null> {
    return prisma.supportTicket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        subject: true,
        status: true,
        priority: true,
        createdAt: true,
        updatedAt: true,
        assignedTechnicianId: true,
        customerId: true,
        activities: {
          select: {
            eventType: true,
            createdAt: true,
            description: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  async getTicketSlaStatus(ticketId: string): Promise<TicketSlaStatus | null> {
    const ticket = await this.getTicketBase(ticketId);
    if (!ticket) return null;
    return toSlaStatus(ticket);
  }

  async getBreachedActiveTickets(limit = 100): Promise<TicketSlaStatus[]> {
    const tickets = await prisma.supportTicket.findMany({
      where: {
        status: { in: ACTIVE_STATUSES },
      },
      take: limit,
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        subject: true,
        status: true,
        priority: true,
        createdAt: true,
        updatedAt: true,
        assignedTechnicianId: true,
        customerId: true,
        activities: {
          select: {
            eventType: true,
            createdAt: true,
            description: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    return tickets
      .map((ticket) => toSlaStatus(ticket))
      .filter((status) => status.responseBreached || status.resolutionBreached);
  }

  async runEscalationSweep() {
    const breachedTickets = await this.getBreachedActiveTickets(500);
    const recipients = await prisma.user.findMany({
      where: { role: { in: [...ESCALATION_ROLES] } },
      select: { id: true },
    });
    const recipientIds = recipients.map((user) => user.id);

    const now = new Date();
    const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
    let escalatedCount = 0;
    let skippedRecentlyEscalated = 0;

    for (const item of breachedTickets) {
      const recentEscalation = await prisma.ticketActivity.findFirst({
        where: {
          ticketId: item.ticketId,
          eventType: 'SLA_ESCALATED',
          createdAt: { gte: sixHoursAgo },
        },
        select: { id: true },
      });

      if (recentEscalation) {
        skippedRecentlyEscalated += 1;
        continue;
      }

      const reasons: string[] = [];
      if (item.responseBreached) reasons.push('response SLA breached');
      if (item.resolutionBreached) reasons.push('resolution SLA breached');

      await prisma.ticketActivity.create({
        data: {
          ticketId: item.ticketId,
          eventType: 'SLA_ESCALATED',
          description: `SLA escalation triggered: ${reasons.join(', ')}`,
          metadata: {
            responseDueAt: item.responseDueAt.toISOString(),
            resolutionDueAt: item.resolutionDueAt.toISOString(),
          },
        },
      });

      const notificationRecipients = new Set<string>(recipientIds);
      if (item.assignedTechnicianId) {
        notificationRecipients.add(item.assignedTechnicianId);
      }

      if (notificationRecipients.size > 0) {
        await prisma.notification.createMany({
          data: Array.from(notificationRecipients).map((userId) => ({
            userId,
            type: 'TICKET_UPDATED',
            title: `SLA Escalation: ${item.subject}`,
            body: `Ticket ${item.ticketId.slice(-6).toUpperCase()} breached SLA. Immediate action required.`,
            metadata: {
              ticketId: item.ticketId,
              responseBreached: item.responseBreached,
              resolutionBreached: item.resolutionBreached,
            },
          })),
        });
      }

      escalatedCount += 1;
    }

    return {
      scanned: breachedTickets.length,
      escalatedCount,
      skippedRecentlyEscalated,
    };
  }
}

export const slaService = new SlaService();
