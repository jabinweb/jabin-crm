import { NotificationType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { notificationService } from '@/lib/crm/notification-service';
import { getAppBaseUrl } from '@/lib/app-url';
import { getCompanyUrl } from '@/lib/company-url';
import { logError } from '@/lib/logger';
import {
  isPlatformEmailConfigured,
  sendProjectNotificationEmail,
  type ProjectEmailContent,
} from '@/lib/email/project-notifications';
import { filterCompanyStaffIds } from '@/lib/projects/mentions';

type NotifyOpts = {
  companyId: string;
  projectId: string;
  taskId: string;
  taskTitle: string;
  actorId: string;
  actorName: string;
};

function taskHref(projectId: string, taskId: string) {
  return `/dashboard/projects/${projectId}/tasks/${taskId}`;
}

function docHref(projectId: string, docId: string) {
  return `/dashboard/projects/${projectId}/docs?doc=${docId}`;
}

async function watcherUserIds(taskId: string, excludeUserId?: string) {
  const watchers = await prisma.projectTaskWatcher.findMany({
    where: { taskId },
    select: { userId: true },
  });
  return watchers
    .map((w) => w.userId)
    .filter((id) => id && id !== excludeUserId);
}

/** Company-level switch: Settings → Notifications → "Enable Email Notifications". */
function emailEnabledInSettings(settings: unknown) {
  if (!settings || typeof settings !== 'object') return true;
  const notifications = (settings as Record<string, unknown>).notifications;
  if (!notifications || typeof notifications !== 'object') return true;
  const email = (notifications as Record<string, unknown>).email;
  if (!email || typeof email !== 'object') return true;
  return (email as Record<string, unknown>).enabled !== false;
}

/**
 * One delivery path for every project notification: in-app row (+ realtime) for
 * each recipient, plus an email when `email` is given and the workspace allows it.
 * Never throws — callers run this after the response.
 */
async function deliver(params: {
  type: NotificationType;
  companyId: string;
  projectId: string;
  userIds: string[];
  title: string;
  body: string;
  /** Logical dashboard path; resolved to the tenant URL by the client / email. */
  href: string;
  metadata?: Record<string, unknown>;
  email?: ProjectEmailContent;
}) {
  const userIds = Array.from(new Set(params.userIds.filter(Boolean)));
  if (userIds.length === 0) return;

  try {
    await Promise.all(
      userIds.map((userId) =>
        notificationService.create({
          type: params.type,
          userId,
          title: params.title,
          body: params.body,
          metadata: {
            companyId: params.companyId,
            projectId: params.projectId,
            href: params.href,
            ...params.metadata,
          },
        })
      )
    );
  } catch (error) {
    logError(error, { context: 'project notification: in-app delivery failed' });
  }

  if (!params.email || !isPlatformEmailConfigured()) return;

  try {
    const [company, project, users] = await Promise.all([
      prisma.company.findUnique({
        where: { id: params.companyId },
        select: { slug: true, settings: true },
      }),
      prisma.project.findUnique({
        where: { id: params.projectId },
        select: { name: true },
      }),
      prisma.user.findMany({
        where: { id: { in: userIds }, userStatus: 'ACTIVE' },
        select: { email: true, name: true },
      }),
    ]);
    if (!company?.slug || !emailEnabledInSettings(company.settings)) return;

    const url = `${getAppBaseUrl().replace(/\/$/, '')}${getCompanyUrl(params.href, company.slug)}`;
    const content = params.email;
    const results = await Promise.allSettled(
      users
        .filter((user) => !!user.email)
        .map((user) =>
          sendProjectNotificationEmail({
            to: user.email,
            recipientName: user.name,
            projectName: project?.name,
            url,
            content,
          })
        )
    );
    for (const result of results) {
      if (result.status === 'rejected') {
        logError(result.reason, { context: 'project notification: email failed' });
      }
    }
  } catch (error) {
    logError(error, { context: 'project notification: email delivery failed' });
  }
}

export async function notifyProjectTaskAssigned(
  opts: NotifyOpts & { assigneeId: string }
) {
  if (!opts.assigneeId || opts.assigneeId === opts.actorId) return;
  await deliver({
    type: NotificationType.PROJECT_TASK_ASSIGNED,
    companyId: opts.companyId,
    projectId: opts.projectId,
    userIds: [opts.assigneeId],
    title: 'Task assigned to you',
    body: `${opts.actorName} assigned you “${opts.taskTitle}”`,
    href: taskHref(opts.projectId, opts.taskId),
    metadata: { taskId: opts.taskId },
    email: {
      subject: `Assigned to you: ${opts.taskTitle}`,
      heading: `${opts.actorName} assigned you a task`,
      message: opts.taskTitle,
      ctaLabel: 'Open task',
    },
  });
}

export async function notifyProjectTaskCommented(
  opts: NotifyOpts & {
    /** Plain-text preview of the comment */
    excerpt?: string | null;
    /** Already notified another way (e.g. @mentioned in the same comment) */
    excludeUserIds?: string[];
  }
) {
  const task = await prisma.projectTask.findUnique({
    where: { id: opts.taskId },
    select: { assigneeId: true, reporterId: true },
  });
  const recipients = new Set<string>(await watcherUserIds(opts.taskId, opts.actorId));
  if (task?.assigneeId) recipients.add(task.assigneeId);
  if (task?.reporterId) recipients.add(task.reporterId);
  recipients.delete(opts.actorId);
  for (const id of opts.excludeUserIds ?? []) recipients.delete(id);

  await deliver({
    type: NotificationType.PROJECT_TASK_COMMENTED,
    companyId: opts.companyId,
    projectId: opts.projectId,
    userIds: Array.from(recipients),
    title: 'New comment on task',
    body: `${opts.actorName} commented on “${opts.taskTitle}”`,
    href: taskHref(opts.projectId, opts.taskId),
    metadata: { taskId: opts.taskId },
    email: {
      subject: `New comment: ${opts.taskTitle}`,
      heading: `${opts.actorName} commented on a task you follow`,
      message: opts.taskTitle,
      excerpt: opts.excerpt,
      ctaLabel: 'View comment',
    },
  });
}

/** In-app only — status churn would be too noisy over email. */
export async function notifyProjectTaskUpdated(
  opts: NotifyOpts & { summary: string }
) {
  const recipients = new Set<string>(await watcherUserIds(opts.taskId, opts.actorId));
  const task = await prisma.projectTask.findUnique({
    where: { id: opts.taskId },
    select: { assigneeId: true },
  });
  if (task?.assigneeId) recipients.add(task.assigneeId);
  recipients.delete(opts.actorId);

  await deliver({
    type: NotificationType.PROJECT_TASK_UPDATED,
    companyId: opts.companyId,
    projectId: opts.projectId,
    userIds: Array.from(recipients),
    title: 'Task updated',
    body: `${opts.actorName} updated “${opts.taskTitle}”: ${opts.summary}`,
    href: taskHref(opts.projectId, opts.taskId),
    metadata: { taskId: opts.taskId },
  });
}

/**
 * @mentions in a task comment, task description, or project doc.
 * Returns the ids actually notified so callers can skip them elsewhere.
 */
export async function notifyProjectMentions(opts: {
  companyId: string;
  projectId: string;
  actorId: string;
  actorName: string;
  mentionedIds: string[];
  excerpt?: string | null;
  target:
    | { kind: 'task-comment' | 'task-description'; taskId: string; title: string }
    | { kind: 'doc'; docId: string; title: string };
}): Promise<string[]> {
  const candidates = opts.mentionedIds.filter((id) => id !== opts.actorId);
  const userIds = await filterCompanyStaffIds(opts.companyId, candidates);
  if (userIds.length === 0) return [];

  const { target } = opts;
  const where =
    target.kind === 'doc'
      ? `the doc “${target.title}”`
      : target.kind === 'task-comment'
        ? `a comment on “${target.title}”`
        : `the description of “${target.title}”`;

  // Mentioned people follow the task from here on
  if (target.kind !== 'doc') {
    await prisma.projectTaskWatcher
      .createMany({
        data: userIds.map((userId) => ({ taskId: target.taskId, userId })),
        skipDuplicates: true,
      })
      .catch((error) =>
        logError(error, { context: 'project mention: auto-watch failed' })
      );
  }

  await deliver({
    type: NotificationType.PROJECT_MENTION,
    companyId: opts.companyId,
    projectId: opts.projectId,
    userIds,
    title: 'You were mentioned',
    body: `${opts.actorName} mentioned you in ${where}`,
    href:
      target.kind === 'doc'
        ? docHref(opts.projectId, target.docId)
        : taskHref(opts.projectId, target.taskId),
    metadata:
      target.kind === 'doc' ? { docId: target.docId } : { taskId: target.taskId },
    email: {
      subject: `${opts.actorName} mentioned you: ${target.title}`,
      heading: `${opts.actorName} mentioned you`,
      message: `In ${where}`,
      excerpt: opts.excerpt,
      ctaLabel: target.kind === 'doc' ? 'Open doc' : 'Open task',
    },
  });

  return userIds;
}
