import { handleRouteError } from '@/lib/api/tenant-response';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { TicketStatus } from '@prisma/client';
import {
  resolveCompanyContextFromRequest,
  TenantError,
} from '@/lib/auth/company-membership';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let companyId: string | undefined;
    try {
      const ctx = await resolveCompanyContextFromRequest(session, request);
      companyId = ctx.companyId;
    } catch (e) {
      if (!(e instanceof TenantError) || e.status !== 400) throw e;
    }

    const customerWhere = companyId ? { companyId } : {};
    const expiringBefore = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const [
      totalCustomers,
      totalEquipment,
      activeTickets,
      cityRows,
      equipmentRows,
      ticketDensity,
      upcomingExpiries,
      recentActivity,
    ] = await Promise.all([
      prisma.customer.count({ where: customerWhere }),
      prisma.equipmentInstallation.count({
        where: companyId ? { customer: { companyId } } : {},
      }),
      prisma.supportTicket.count({
        where: {
          status: { notIn: [TicketStatus.RESOLVED, TicketStatus.CLOSED] },
          ...(companyId ? { customer: { companyId } } : {}),
        },
      }),
      prisma.customer.groupBy({
        by: ['city'],
        where: { city: { not: null }, ...customerWhere },
        _count: true,
        orderBy: { _count: { city: 'desc' } },
        take: 8,
      }),
      prisma.equipmentInstallation.groupBy({
        by: ['status'],
        where: companyId ? { customer: { companyId } } : {},
        _count: true,
      }),
      prisma.supportTicket.groupBy({
        by: ['customerId'],
        where: companyId ? { customer: { companyId } } : {},
        _count: true,
        orderBy: { _count: { customerId: 'desc' } },
        take: 8,
      }),
      prisma.equipmentInstallation.findMany({
        where: {
          warrantyExpiry: { gte: new Date(), lte: expiringBefore },
          ...(companyId ? { customer: { companyId } } : {}),
        },
        include: {
          product: { select: { name: true } },
          customer: { select: { organizationName: true } },
        },
        orderBy: { warrantyExpiry: 'asc' },
        take: 10,
      }),
      prisma.customerActivity.findMany({
        where: companyId ? { customer: { companyId } } : {},
        orderBy: { createdAt: 'desc' },
        take: 15,
        include: {
          customer: { select: { organizationName: true } },
        },
      }),
    ]);

    const customerNames = await prisma.customer.findMany({
      where: { id: { in: ticketDensity.map((t) => t.customerId) } },
      select: { id: true, organizationName: true },
    });
    const nameById = Object.fromEntries(customerNames.map((c) => [c.id, c.organizationName]));

    return NextResponse.json({
      summary: { totalCustomers, totalEquipment, activeTickets },
      cityDistribution: cityRows
        .filter((row) => row.city)
        .map((row) => ({ name: row.city!, count: row._count })),
      equipmentStatus: equipmentRows.map((row) => ({
        status: row.status,
        count: row._count,
      })),
      highDemandAccounts: ticketDensity.map((row) => ({
        name: nameById[row.customerId] ?? 'Unknown',
        ticketCount: row._count,
      })),
      upcomingExpiries,
      recentActivity: recentActivity.map((a) => ({
        id: a.id,
        eventType: a.eventType,
        description: a.description,
        createdAt: a.createdAt,
        customer: a.customer,
      })),
    });
  } catch (error) {
    return handleRouteError(error);
    console.error('[api/dashboard/customer-stats]', error);
    return NextResponse.json({ error: 'Failed to fetch customer stats' }, { status: 500 });
  }
}
