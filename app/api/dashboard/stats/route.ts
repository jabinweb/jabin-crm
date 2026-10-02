import { prisma } from '@/lib/prisma';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';
import { getFeatureModuleMap } from '@/lib/feature-modules';
import { hasLegacyRole } from '@/lib/auth/permissions';

/**
 * Command-center metrics for the tenant home dashboard.
 * Module metrics are only counted when the plan includes the module (lead metrics
 * also need a role that works the pipeline); the others come back as null.
 */
export const GET = withTenantRoute(async (_req, { companyId, userId, session }) => {
  const modules = await getFeatureModuleMap(userId, companyId);
  const ticketsOn = modules.TICKETS === true;
  const equipmentOn = modules.EQUIPMENT === true;
  const leadsOn =
    modules.LEADS === true &&
    hasLegacyRole(session, 'ADMIN', 'SUPER_ADMIN', 'SALES', 'SUPPORT_MANAGER');
  const skip = Promise.resolve(null);
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
    !ticketsOn ? skip : prisma.supportTicket.count({
      where: {
        customer: { companyId },
        mergedIntoId: null,
        status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] },
      },
    }),
    !equipmentOn ? skip : prisma.equipmentInstallation.count({
      where: { customer: { companyId } },
    }),
    !leadsOn ? skip : prisma.lead.count({ where: { companyId } }),
    !leadsOn ? skip : prisma.lead.count({ where: { companyId, createdAt: { gte: weekAgo } } }),
    !leadsOn ? skip : prisma.lead.count({
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
    leadsThisWeek === null || leadsPrevWeek === null
      ? null
      : leadsPrevWeek > 0
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
