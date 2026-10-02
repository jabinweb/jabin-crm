import type { Session } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { syncProjectProgress } from '@/lib/projects/sync-project-progress';

export type TaskDeleteResult =
  | { ok: false; status: number; error: string }
  | { ok: true; title: string; progress: number; effects: () => Promise<void> };

/**
 * Single write path for deleting a project task (board, task page, OPS agent): removes it,
 * recomputes progress, and tells its followers and the project team. Callers check access.
 */
export async function deleteProjectTask(params: {
  session: Session;
  companyId: string;
  projectId: string;
  taskId: string;
}): Promise<TaskDeleteResult> {
  const { session, companyId, projectId, taskId } = params;
  const task = await prisma.projectTask.findFirst({
    where: { id: taskId, projectId, project: { companyId } },
    select: { id: true, title: true },
  });
  if (!task) return { ok: false, status: 404, error: 'Not found' };

  // Followers must be read before the cascade removes the watcher rows
  const { taskFollowerIds, notifyProjectTaskDeleted } = await import(
    '@/lib/projects/task-notifications'
  );
  const followerIds = await taskFollowerIds(task.id);

  await prisma.projectTask.delete({ where: { id: task.id } });
  const progress = await syncProjectProgress(projectId, companyId);

  const actorName = session.user.name || session.user.email || 'User';
  const effects = () =>
    notifyProjectTaskDeleted({
      companyId,
      projectId,
      taskTitle: task.title,
      actorId: session.user.id,
      actorName,
      followerIds,
    });

  return { ok: true, title: task.title, progress, effects };
}
