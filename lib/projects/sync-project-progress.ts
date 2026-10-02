import { prisma } from '@/lib/prisma';
import { computeProgressFromTasks } from '@/lib/projects/task-board';
import { resolveDoneStatusIds } from '@/lib/projects/task-statuses';
import { computeProgressFromMilestones } from '@/lib/projects/agency-delivery';

/** Company.settings blob used for custom project task statuses. */
export async function getCompanyProjectTaskSettings(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { settings: true },
  });
  return company?.settings;
}

/**
 * Recompute and persist project.progress: share of tasks done when the project has
 * tasks, otherwise share of milestones done. The one rule for every writer.
 */
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
  let progress: number;
  if (tasks.length > 0) {
    progress = computeProgressFromTasks(tasks, resolveDoneStatusIds(settings));
  } else {
    const milestones = await prisma.projectMilestone.findMany({
      where: { projectId },
      select: { status: true },
    });
    progress = computeProgressFromMilestones(milestones);
  }
  await prisma.project.update({ where: { id: projectId }, data: { progress } });
  return progress;
}
