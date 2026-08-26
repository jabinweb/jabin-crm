import { prisma } from '@/lib/prisma';
import { computeProgressFromTasks } from '@/lib/projects/task-board';
import { resolveDoneStatusIds } from '@/lib/projects/task-statuses';

/** Company.settings blob used for custom project task statuses. */
export async function getCompanyProjectTaskSettings(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { settings: true },
  });
  return company?.settings;
}

/** Recompute and persist project.progress from ProjectTask status counts. */
export async function syncProjectProgress(
  projectId: string,
  companyId: string
): Promise<number> {
  const [statusCounts, settings] = await Promise.all([
    prisma.projectTask.groupBy({
      by: ['status'],
      where: { projectId },
      _count: { _all: true },
    }),
    getCompanyProjectTaskSettings(companyId),
  ]);
  const tasks = statusCounts.flatMap((row) =>
    Array.from({ length: row._count._all }, () => ({ status: row.status }))
  );
  const progress = computeProgressFromTasks(
    tasks,
    resolveDoneStatusIds(settings)
  );
  await prisma.project.update({ where: { id: projectId }, data: { progress } });
  return progress;
}
