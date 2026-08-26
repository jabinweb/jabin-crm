import { prisma } from '@/lib/prisma';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';
import { aggregateCompanyProjectHours } from '@/lib/projects/delivery-hours';

/** Hours logged per project (timesheets + worklogs) for the company. */
export const GET = withTenantRoute(async (request, { companyId }) => {
  const url = new URL(request.url);
  const projectId = url.searchParams.get('projectId');

  const [entries, summary] = await Promise.all([
    prisma.timesheetEntry.findMany({
      where: {
        project: { companyId },
        ...(projectId ? { projectId } : { projectId: { not: null } }),
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            customer: { select: { id: true, organizationName: true } },
          },
        },
        timesheet: {
          select: {
            employee: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { date: 'desc' },
      take: 500,
    }),
    aggregateCompanyProjectHours(companyId, projectId),
  ]);

  return jsonOk({
    entries,
    summary,
  });
});
