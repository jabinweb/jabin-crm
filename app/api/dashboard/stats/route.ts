import { prisma } from '@/lib/prisma';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';

/** Command-center metrics for the tenant home dashboard. */
export const GET = withTenantRoute(async (_req, { companyId }) => {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    customers,
    openTickets,
    equipmentInstalled,
    totalLeads,
    leadsThisWeek,
    leadsPrevWeek,
    employees,
    products,
  ] = await Promise.all([
    prisma.customer.count({ where: { companyId } }),
    prisma.supportTicket.count({
      where: {
        customer: { companyId },
        mergedIntoId: null,
        status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] },
      },
    }),
    prisma.equipmentInstallation.count({
      where: { customer: { companyId } },
    }),
    prisma.lead.count({ where: { companyId } }),
    prisma.lead.count({ where: { companyId, createdAt: { gte: weekAgo } } }),
    prisma.lead.count({
      where: {
        companyId,
        createdAt: {
          gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
          lt: weekAgo,
        },
      },
    }),
    prisma.employee.count({ where: { companyId } }),
    prisma.product.count({ where: { companyId } }),
  ]);

  const weeklyGrowth =
    leadsPrevWeek > 0
      ? Math.round(((leadsThisWeek - leadsPrevWeek) / leadsPrevWeek) * 100)
      : leadsThisWeek > 0
        ? 100
        : 0;

  return jsonOk({
    totalCustomers: customers,
    customers,
    openTickets,
    equipmentInstalled,
    totalLeads,
    weeklyGrowth,
    employees,
    products,
    /** @deprecated Use `customers` */
    clients: customers,
  });
});
