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
  /** Workspace Slack channels: posted once per event, regardless of recipients */
  slack?: { event: string; title: string; text: string };
}) {
  if (params.slack) {
    const { sendWorkspaceSlackEvent } = await import('@/lib/integrations/slack');
    await sendWorkspaceSlackEvent(params.companyId, params.slack.event, {
      title: params.slack.title,
      text: params.slack.text,
      href: params.href,
    });
  }

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
    slack: {
      event: 'project.task.assigned',
      title: 'Task assigned',
      text: `${opts.actorName} assigned “${opts.taskTitle}”`,
    },
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
    slack: {
      event: 'project.task.commented',
      title: 'New task comment',
      text: `${opts.actorName} on “${opts.taskTitle}”${opts.excerpt ? `: ${opts.excerpt}` : ''}`,
    },
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
    select: { assigneeId: true, project: { select: { pmUserId: true } } },
  });
  if (task?.assigneeId) recipients.add(task.assigneeId);
  // The project lead follows every task on their project
  if (task?.project.pmUserId) recipients.add(task.project.pmUserId);
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
    slack: {
      event: 'project.mention',
      title: 'Mention',
      text: `${opts.actorName} mentioned a teammate in ${where}`,
    },
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

// ── Project-level notifications ─────────────────────────────────────────────
// Reuse the PROJECT_TASK_UPDATED type (no schema change); metadata.kind says what happened.

function projectHref(projectId: string) {
  return `/dashboard/projects/${projectId}`;
}

/** The project lead and members (who follow everything on the project). */
export async function projectTeamUserIds(projectId: string): Promise<string[]> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { pmUserId: true, members: { select: { userId: true } } },
  });
  if (!project) return [];
  return Array.from(
    new Set([...(project.pmUserId ? [project.pmUserId] : []), ...project.members.map((m) => m.userId)])
  );
}

async function projectName(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true },
  });
  return project?.name ?? 'a project';
}

/** New task: tell the project team (the assignee gets the "assigned" notification instead). */
export async function notifyProjectTaskCreated(
  opts: NotifyOpts & { assigneeId?: string | null }
) {
  const recipients = new Set(await projectTeamUserIds(opts.projectId));
  recipients.delete(opts.actorId);
  if (opts.assigneeId) recipients.delete(opts.assigneeId);
  if (recipients.size === 0) return;
  await deliver({
    type: NotificationType.PROJECT_TASK_UPDATED,
    companyId: opts.companyId,
    projectId: opts.projectId,
    userIds: Array.from(recipients),
    title: 'New task',
    body: `${opts.actorName} added “${opts.taskTitle}” to ${await projectName(opts.projectId)}`,
    href: taskHref(opts.projectId, opts.taskId),
    metadata: { taskId: opts.taskId, kind: 'task_created' },
  });
}

/**
 * Task deleted: people who followed it (watchers, assignee — collected before the delete)
 * plus the project team.
 */
export async function notifyProjectTaskDeleted(opts: {
  companyId: string;
  projectId: string;
  taskTitle: string;
  actorId: string;
  actorName: string;
  followerIds: string[];
}) {
  const recipients = new Set([...opts.followerIds, ...(await projectTeamUserIds(opts.projectId))]);
  recipients.delete(opts.actorId);
  if (recipients.size === 0) return;
  await deliver({
    type: NotificationType.PROJECT_TASK_UPDATED,
    companyId: opts.companyId,
    projectId: opts.projectId,
    userIds: Array.from(recipients),
    title: 'Task deleted',
    body: `${opts.actorName} deleted “${opts.taskTitle}” from ${await projectName(opts.projectId)}`,
    href: projectHref(opts.projectId),
    metadata: { kind: 'task_deleted' },
  });
}

/** Watchers + assignee of a task, read before deleting it. */
export async function taskFollowerIds(taskId: string): Promise<string[]> {
  const task = await prisma.projectTask.findUnique({
    where: { id: taskId },
    select: { assigneeId: true, watchers: { select: { userId: true } } },
  });
  if (!task) return [];
  return [...(task.assigneeId ? [task.assigneeId] : []), ...task.watchers.map((w) => w.userId)];
}

/**
 * Project-level change (status, dates, milestones, budget…): the project team hears
 * about it, and Slack channels subscribed to "project.updated".
 */
export async function notifyProjectChanged(opts: {
  companyId: string;
  projectId: string;
  actorId: string;
  actorName: string;
  /** e.g. "changed the status to On hold" */
  summary: string;
  kind: string;
  /** Already told separately (e.g. a new lead) */
  excludeUserIds?: string[];
}) {
  const recipients = new Set(await projectTeamUserIds(opts.projectId));
  recipients.delete(opts.actorId);
  for (const id of opts.excludeUserIds ?? []) recipients.delete(id);
  const name = await projectName(opts.projectId);
  await deliver({
    type: NotificationType.PROJECT_TASK_UPDATED,
    companyId: opts.companyId,
    projectId: opts.projectId,
    userIds: Array.from(recipients),
    title: `${name} updated`,
    body: `${opts.actorName} ${opts.summary}`,
    href: projectHref(opts.projectId),
    metadata: { kind: opts.kind },
    slack: {
      event: 'project.updated',
      title: `${name} updated`,
      text: `${opts.actorName} ${opts.summary}`,
    },
  });
}

/** Someone was made the project lead or added to the team (in-app + email). */
export async function notifyProjectJoined(opts: {
  companyId: string;
  projectId: string;
  actorId: string;
  actorName: string;
  userId: string;
  role: 'lead' | 'member';
}) {
  if (!opts.userId || opts.userId === opts.actorId) return;
  const name = await projectName(opts.projectId);
  const lead = opts.role === 'lead';
  await deliver({
    type: NotificationType.PROJECT_TASK_ASSIGNED,
    companyId: opts.companyId,
    projectId: opts.projectId,
    userIds: [opts.userId],
    title: lead ? `You're leading ${name}` : `Added to ${name}`,
    body: lead
      ? `${opts.actorName} made you the project lead of ${name}`
      : `${opts.actorName} added you to the ${name} team`,
    href: projectHref(opts.projectId),
    metadata: { kind: lead ? 'project_lead' : 'project_member' },
    email: {
      subject: lead ? `You're now leading ${name}` : `You've been added to ${name}`,
      heading: lead
        ? `${opts.actorName} made you the project lead`
        : `${opts.actorName} added you to the project team`,
      message: name,
      ctaLabel: 'Open project',
    },
  });
}

const PROJECT_STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Active',
  ON_HOLD: 'On hold',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

type ProjectSnapshot = {
  name: string;
  status: string;
  startDate: Date;
  endDate: Date;
  pmUserId: string | null;
  budgetHours?: number | null;
};

const shortDate = (d: Date) =>
  d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * After a project edit (page or OPS agent): a new lead is told directly, and the team
 * gets one summary of what changed. Cosmetic-only edits (description) stay quiet.
 */
export async function notifyProjectEdited(opts: {
  companyId: string;
  projectId: string;
  actorId: string;
  actorName: string;
  before: ProjectSnapshot;
  after: ProjectSnapshot;
}) {
  const { before, after } = opts;
  const changes: string[] = [];
  if (after.status !== before.status) {
    changes.push(`changed the status to ${PROJECT_STATUS_LABEL[after.status] ?? after.status}`);
  }
  if (after.name !== before.name) changes.push(`renamed it to “${after.name}”`);
  if (after.endDate.getTime() !== before.endDate.getTime()) {
    changes.push(`moved the due date to ${shortDate(after.endDate)}`);
  }
  if (after.startDate.getTime() !== before.startDate.getTime()) {
    changes.push(`moved the start date to ${shortDate(after.startDate)}`);
  }
  if ((after.budgetHours ?? null) !== (before.budgetHours ?? null)) {
    changes.push(after.budgetHours != null ? `set the hour budget to ${after.budgetHours}h` : 'cleared the hour budget');
  }
  const leadChanged = after.pmUserId !== before.pmUserId;
  if (leadChanged) {
    if (after.pmUserId) {
      const lead = await prisma.user.findUnique({
        where: { id: after.pmUserId },
        select: { name: true, email: true },
      });
      changes.push(`made ${lead?.name || lead?.email || 'someone'} the project lead`);
      await notifyProjectJoined({ ...opts, userId: after.pmUserId, role: 'lead' });
    } else {
      changes.push('removed the project lead');
    }
  }
  if (changes.length === 0) return;
  await notifyProjectChanged({
    companyId: opts.companyId,
    projectId: opts.projectId,
    actorId: opts.actorId,
    actorName: opts.actorName,
    summary: changes.join(', '),
    kind: 'project_updated',
    // The new lead already got "You're leading …"
    excludeUserIds: leadChanged && after.pmUserId ? [after.pmUserId] : [],
  });
}

/** Milestone added / started / completed / reopened / removed → project team. */
export async function notifyMilestoneChange(opts: {
  companyId: string;
  projectId: string;
  actorId: string;
  actorName: string;
  title: string;
  action: 'added' | 'removed' | 'status';
  status?: string;
  previousStatus?: string;
}) {
  let verb: string;
  if (opts.action === 'added') verb = 'added the milestone';
  else if (opts.action === 'removed') verb = 'removed the milestone';
  else if (opts.status === 'DONE') verb = 'completed the milestone';
  else if (opts.status === 'IN_PROGRESS') verb = 'started the milestone';
  else if (opts.previousStatus === 'DONE') verb = 'reopened the milestone';
  else return;
  await notifyProjectChanged({
    companyId: opts.companyId,
    projectId: opts.projectId,
    actorId: opts.actorId,
    actorName: opts.actorName,
    summary: `${verb} “${opts.title}”`,
    kind: 'milestone',
  });
}
