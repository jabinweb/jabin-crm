import { prisma } from '@/lib/prisma';
import { combineBurnHours } from '@/lib/projects/delivery-hours-math';

export type ProjectHoursBreakdown = {
  timesheetHours: number;
  worklogHours: number;
  /** Deduped burn total used for budget % */
  hoursLogged: number;
  billableTimesheetHours: number;
  projectLevelTimesheetHours: number;
  taskLinkedTimesheetHours: number;
};

/** Single definition of project burn hours (timesheets + task worklogs, no double-count). */
export async function aggregateProjectHours(
  projectId: string
): Promise<ProjectHoursBreakdown> {
  const [allTs, projectLevelTs, taskLinkedTs, billableAgg, worklogAgg] =
    await Promise.all([
      prisma.timesheetEntry.aggregate({
        where: { projectId },
        _sum: { hours: true },
      }),
      prisma.timesheetEntry.aggregate({
        where: { projectId, projectTaskId: null },
        _sum: { hours: true },
      }),
      prisma.timesheetEntry.aggregate({
        where: { projectId, projectTaskId: { not: null } },
        _sum: { hours: true },
      }),
      prisma.timesheetEntry.aggregate({
        where: { projectId, billable: true },
        _sum: { hours: true },
      }),
      prisma.projectTaskWorklog.aggregate({
        where: { task: { projectId } },
        _sum: { hours: true },
      }),
    ]);

  const timesheetHours = allTs._sum.hours ?? 0;
  const projectLevelTimesheetHours = projectLevelTs._sum.hours ?? 0;
  const taskLinkedTimesheetHours = taskLinkedTs._sum.hours ?? 0;
  const worklogHours = worklogAgg._sum.hours ?? 0;

  return {
    timesheetHours,
    worklogHours,
    projectLevelTimesheetHours,
    taskLinkedTimesheetHours,
    hoursLogged: combineBurnHours({
      projectLevelTimesheetHours,
      taskLinkedTimesheetHours,
      worklogHours,
    }),
    billableTimesheetHours: billableAgg._sum.hours ?? 0,
  };
}

export type CompanyProjectHoursRow = {
  projectId: string;
  projectName: string;
  clientName: string | null;
  timesheetHours: number;
  worklogHours: number;
  totalHours: number;
  billableHours: number;
};

/** Company-wide hours summary — batched (no per-project N+1). */
export async function aggregateCompanyProjectHours(
  companyId: string,
  projectId?: string | null
): Promise<CompanyProjectHoursRow[]> {
  const projectFilter = projectId
    ? { id: projectId, companyId }
    : { companyId };

  const projects = await prisma.project.findMany({
    where: projectFilter,
    select: {
      id: true,
      name: true,
      customer: { select: { organizationName: true } },
    },
  });
  if (projects.length === 0) return [];

  const ids = projects.map((p) => p.id);

  const [timesheetRows, worklogRows] = await Promise.all([
    prisma.timesheetEntry.findMany({
      where: { projectId: { in: ids } },
      select: {
        projectId: true,
        projectTaskId: true,
        billable: true,
        hours: true,
      },
    }),
    prisma.projectTaskWorklog.findMany({
      where: { task: { projectId: { in: ids } } },
      select: {
        hours: true,
        task: { select: { projectId: true } },
      },
    }),
  ]);

  type Acc = {
    timesheetHours: number;
    projectLevel: number;
    taskLinked: number;
    billable: number;
    worklogHours: number;
  };
  const byProject = new Map<string, Acc>();
  for (const id of ids) {
    byProject.set(id, {
      timesheetHours: 0,
      projectLevel: 0,
      taskLinked: 0,
      billable: 0,
      worklogHours: 0,
    });
  }

  for (const row of timesheetRows) {
    if (!row.projectId) continue;
    const acc = byProject.get(row.projectId);
    if (!acc) continue;
    acc.timesheetHours += row.hours;
    if (row.billable) acc.billable += row.hours;
    if (row.projectTaskId) acc.taskLinked += row.hours;
    else acc.projectLevel += row.hours;
  }

  for (const row of worklogRows) {
    const pid = row.task.projectId;
    const acc = byProject.get(pid);
    if (!acc) continue;
    acc.worklogHours += row.hours;
  }

  return projects
    .map((p) => {
      const acc = byProject.get(p.id) ?? {
        timesheetHours: 0,
        projectLevel: 0,
        taskLinked: 0,
        billable: 0,
        worklogHours: 0,
      };
      return {
        projectId: p.id,
        projectName: p.name,
        clientName: p.customer?.organizationName ?? null,
        timesheetHours: acc.timesheetHours,
        worklogHours: acc.worklogHours,
        totalHours: combineBurnHours({
          projectLevelTimesheetHours: acc.projectLevel,
          taskLinkedTimesheetHours: acc.taskLinked,
          worklogHours: acc.worklogHours,
        }),
        billableHours: acc.billable,
      };
    })
    .filter((r) => r.totalHours > 0 || !!projectId)
    .sort((a, b) => b.totalHours - a.totalHours);
}

export {
  sumHours,
  burnPercent,
  combineBurnHours,
} from '@/lib/projects/delivery-hours-math';
