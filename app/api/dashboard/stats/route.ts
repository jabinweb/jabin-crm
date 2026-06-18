import { prisma } from '@/lib/prisma';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';

export const GET = withTenantRoute(async (_req, { companyId }) => {
  const [employees, customers, products, projects] = await Promise.all([
    prisma.employee.count({ where: { companyId } }),
    prisma.customer.count({ where: { companyId } }),
    prisma.product.count({ where: { companyId } }),
    prisma.project.count({ where: { companyId } }),
  ]);

  return jsonOk({
    employees,
    customers,
    products,
    projects,
    /** @deprecated Use `customers` */
    clients: customers,
  });
});
