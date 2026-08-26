import { NotificationType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { notificationService } from '@/lib/crm/notification-service';

type NotifyOpts = {
  companyId: string;
  projectId: string;
  taskId: string;
  taskTitle: string;
  actorId: string;
  actorName: string;
};

async function watcherUserIds(taskId: string, excludeUserId?: string) {
  const watchers = await prisma.projectTaskWatcher.findMany({
    where: { taskId },
    select: { userId: true },
  });
  return watchers
    .map((w) => w.userId)
    .filter((id) => id && id !== excludeUserId);
}

export async function notifyProjectTaskAssigned(
  opts: NotifyOpts & { assigneeId: string }
) {
  if (!opts.assigneeId || opts.assigneeId === opts.actorId) return;
  await notificationService.create({
    type: NotificationType.PROJECT_TASK_ASSIGNED,
    userId: opts.assigneeId,
    title: 'Task assigned to you',
    body: `${opts.actorName} assigned you “${opts.taskTitle}”`,
    metadata: {
      companyId: opts.companyId,
      projectId: opts.projectId,
      taskId: opts.taskId,
      href: `/dashboard/projects/${opts.projectId}/tasks/${opts.taskId}`,
    },
  });
}

export async function notifyProjectTaskCommented(opts: NotifyOpts) {
  const task = await prisma.projectTask.findUnique({
    where: { id: opts.taskId },
    select: { assigneeId: true, reporterId: true },
  });
  const recipients = new Set<string>([
    ...(await watcherUserIds(opts.taskId, opts.actorId)),
  ]);
  if (task?.assigneeId && task.assigneeId !== opts.actorId) {
    recipients.add(task.assigneeId);
  }
  if (task?.reporterId && task.reporterId !== opts.actorId) {
    recipients.add(task.reporterId);
  }

  await Promise.all(
    Array.from(recipients).map((userId) =>
      notificationService.create({
        type: NotificationType.PROJECT_TASK_COMMENTED,
        userId,
        title: 'New comment on task',
        body: `${opts.actorName} commented on “${opts.taskTitle}”`,
        metadata: {
          companyId: opts.companyId,
          projectId: opts.projectId,
          taskId: opts.taskId,
          href: `/dashboard/projects/${opts.projectId}/tasks/${opts.taskId}`,
        },
      })
    )
  );
}

export async function notifyProjectTaskUpdated(
  opts: NotifyOpts & { summary: string }
) {
  const recipients = new Set<string>(
    await watcherUserIds(opts.taskId, opts.actorId)
  );
  const task = await prisma.projectTask.findUnique({
    where: { id: opts.taskId },
    select: { assigneeId: true },
  });
  if (task?.assigneeId && task.assigneeId !== opts.actorId) {
    recipients.add(task.assigneeId);
  }

  await Promise.all(
    Array.from(recipients).map((userId) =>
      notificationService.create({
        type: NotificationType.PROJECT_TASK_UPDATED,
        userId,
        title: 'Task updated',
        body: `${opts.actorName} updated “${opts.taskTitle}”: ${opts.summary}`,
        metadata: {
          companyId: opts.companyId,
          projectId: opts.projectId,
          taskId: opts.taskId,
          href: `/dashboard/projects/${opts.projectId}/tasks/${opts.taskId}`,
        },
      })
    )
  );
}
