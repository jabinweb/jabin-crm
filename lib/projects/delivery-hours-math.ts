/** Pure burn/budget helpers — safe for client components (no Prisma). */

export function sumHours(
  timesheetHours: number | null | undefined,
  worklogHours: number | null | undefined
): number {
  return (timesheetHours ?? 0) + (worklogHours ?? 0);
}

/**
 * Avoid double-counting when both timesheets and worklogs exist for task time.
 * - Always count project-level timesheets (no projectTaskId)
 * - Prefer worklogs for task time when any worklogs exist; otherwise use task-linked timesheets
 */
export function combineBurnHours(input: {
  projectLevelTimesheetHours: number;
  taskLinkedTimesheetHours: number;
  worklogHours: number;
}): number {
  const projectLevel = input.projectLevelTimesheetHours ?? 0;
  const taskLinked = input.taskLinkedTimesheetHours ?? 0;
  const worklogs = input.worklogHours ?? 0;
  const taskTime = worklogs > 0 ? worklogs : taskLinked;
  return projectLevel + taskTime;
}

export function burnPercent(
  logged: number,
  budget: number | null | undefined
): number | null {
  if (budget == null || budget <= 0) return null;
  return Math.min(999, Math.round((logged / budget) * 100));
}
