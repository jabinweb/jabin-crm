import { prisma } from '@/lib/prisma';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';

/** Hours logged per project / client for the company. */
export const GET = withTenantRoute(async (request, { companyId }) => {
  const url = new URL(request.url);
  const projectId = url.searchParams.get('projectId');

  const entries = await prisma.timesheetEntry.findMany({
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
  });

  const byProject = new Map<
    string,
    {
      projectId: string;
      projectName: string;
      clientName: string | null;
      totalHours: number;
      billableHours: number;
    }
  >();

  for (const e of entries) {
    if (!e.project) continue;
    const key = e.project.id;
    const row = byProject.get(key) || {
      projectId: e.project.id,
      projectName: e.project.name,
      clientName: e.project.customer?.organizationName ?? null,
      totalHours: 0,
      billableHours: 0,
    };
    row.totalHours += e.hours;
    if (e.billable) row.billableHours += e.hours;
    byProject.set(key, row);
  }

  return jsonOk({
    entries,
    summary: Array.from(byProject.values()).sort(
      (a, b) => b.totalHours - a.totalHours
    ),
  });
});
