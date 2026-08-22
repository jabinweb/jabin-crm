import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';
import {
  InvoiceStatus,
  LeadStatus,
  ServiceContractStatus,
  TicketStatus,
} from '@prisma/client';

export const GET = withTenantRoute(async (_request, { companyId }, routeContext) => {
  const customerId = (await routeContext.params).id;
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, companyId: companyId! },
    select: {
      id: true,
      organizationName: true,
      email: true,
      contactPerson: true,
    },
  });
  if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const closed: TicketStatus[] = [TicketStatus.CLOSED, TicketStatus.RESOLVED];

  const [openTickets, recentTickets, openInvoices, activeContracts, lastCsatTicket] =
    await Promise.all([
      prisma.supportTicket.count({
        where: {
          customerId,
          status: { notIn: closed },
          mergedIntoId: null,
        },
      }),
      prisma.supportTicket.findMany({
        where: { customerId, mergedIntoId: null },
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: { id: true, subject: true, status: true },
      }),
      prisma.invoice.count({
        where: {
          customerId,
          status: {
            in: [
              InvoiceStatus.SENT,
              InvoiceStatus.VIEWED,
              InvoiceStatus.OVERDUE,
              InvoiceStatus.PARTIAL,
            ],
          },
        },
      }),
      prisma.serviceContract.count({
        where: {
          customerId,
          status: ServiceContractStatus.ACTIVE,
        },
      }),
      prisma.supportTicket.findFirst({
        where: { customerId, csatRating: { not: null } },
        orderBy: { csatSubmittedAt: 'desc' },
        select: { csatRating: true },
      }),
    ]);

  return jsonOk({
    customer,
    openTickets,
    recentTickets,
    openInvoices,
    activeContracts,
    lastCsat: lastCsatTicket?.csatRating ?? null,
  });
});
