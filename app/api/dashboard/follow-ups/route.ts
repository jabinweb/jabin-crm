import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';
import { LeadStatus, TicketStatus } from '@prisma/client';
import { getFeatureModuleMap } from '@/lib/feature-modules';
import { hasLegacyRole } from '@/lib/auth/permissions';

const STALE_DAYS = 7;

/**
 * Stale leads + tickets with no activity for follow-up nudges + my queue.
 * Each list is only returned when the plan includes its module (and, for leads, the
 * role works the sales pipeline — technicians do not).
 */
export const GET = withTenantRoute(async (_request, { companyId, session, userId }) => {
  if (!companyId) return NextResponse.json({ error: 'No company' }, { status: 400 });
  const modules = await getFeatureModuleMap(userId, companyId);
  const ticketsOn = modules.TICKETS === true;
  const leadsOn =
    modules.LEADS === true &&
    hasLegacyRole(session, 'ADMIN', 'SUPER_ADMIN', 'SALES', 'SUPPORT_MANAGER');
  const since = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000);
  const openStatuses: TicketStatus[] = [
    TicketStatus.OPEN,
    TicketStatus.ASSIGNED,
    TicketStatus.IN_PROGRESS,
  ];

  const [staleTickets, staleLeads, myOpenTickets, nextSla] = await Promise.all([
    !ticketsOn ? Promise.resolve([]) : prisma.supportTicket.findMany({
      where: {
        customer: { companyId },
        mergedIntoId: null,
        status: { in: openStatuses },
        updatedAt: { lt: since },
      },
      orderBy: { updatedAt: 'asc' },
      take: 8,
      select: {
        id: true,
        subject: true,
        status: true,
        updatedAt: true,
        customer: { select: { organizationName: true } },
      },
    }),
    !leadsOn ? Promise.resolve([]) : prisma.lead.findMany({
      where: {
        companyId,
        status: {
          notIn: [LeadStatus.WON, LeadStatus.LOST, LeadStatus.CONVERTED],
        },
        updatedAt: { lt: since },
      },
      orderBy: { updatedAt: 'asc' },
      take: 8,
      select: {
        id: true,
        name: true,
        companyName: true,
        status: true,
        updatedAt: true,
      },
    }),
    !ticketsOn ? Promise.resolve([]) : prisma.supportTicket.findMany({
      where: {
        customer: { companyId },
        assignedTechnicianId: session.user.id,
        mergedIntoId: null,
        status: { in: openStatuses },
      },
      orderBy: [{ responseDueAt: 'asc' }, { createdAt: 'asc' }],
      take: 10,
      select: {
        id: true,
        subject: true,
        status: true,
        priority: true,
        responseDueAt: true,
        resolutionDueAt: true,
        channel: true,
      },
    }),
    !ticketsOn ? Promise.resolve(null) : prisma.supportTicket.findFirst({
      where: {
        customer: { companyId },
        assignedTechnicianId: session.user.id,
        mergedIntoId: null,
        status: { in: openStatuses },
        OR: [{ responseDueAt: { not: null } }, { resolutionDueAt: { not: null } }],
      },
      orderBy: { responseDueAt: 'asc' },
      select: {
        id: true,
        subject: true,
        responseDueAt: true,
        resolutionDueAt: true,
      },
    }),
  ]);

  return jsonOk({
    staleTickets,
    staleLeads,
    myOpenTickets,
    nextSla,
    staleDays: STALE_DAYS,
    ticketsEnabled: ticketsOn,
    leadsEnabled: leadsOn,
  });
});
