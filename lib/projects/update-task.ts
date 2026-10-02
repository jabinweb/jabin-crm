import type { Session } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { adfToHtml, isAdfDoc } from '@/lib/adf/adf';
import { PROJECT_PRIORITIES } from '@/lib/projects/task-board';
import { isAllowedProjectTaskStatus } from '@/lib/projects/task-statuses';
import {
  assertProjectTask,
  stripHtmlToPreview,
} from '@/lib/projects/task-activity';
import {
  getCompanyProjectTaskSettings,
  syncProjectProgress,
} from '@/lib/projects/sync-project-progress';
import { sanitizeRichText } from '@/lib/html/sanitize-rich-text';
import { isCompanyStaff, newMentionIds } from '@/lib/projects/mentions';

const PERSON_SELECT = { id: true, name: true, email: true, image: true } as const;

type ActivityRow = {
  eventType: string;
  description: string;
  metadata?: Record<string, unknown>;
};

export type TaskUpdateResult =
  | { ok: false; status: number; error: string }
  | {
      ok: true;
      changed: boolean;
      task: unknown;
      progress?: number;
      /** Notifications / workflow events — run after the response is sent. */
      effects: () => Promise<void>;
    };

/**
 * Single write path for editing a project task. Used by the task detail page and
 * the board (edit dialog, inline changes) so both log activity and notify alike.
 */
export async function updateProjectTask(params: {
  session: Session;
  companyId: string;
  projectId: string;
  taskId: string;
  body: Record<string, unknown>;
}): Promise<TaskUpdateResult> {
  const { session, companyId, projectId, taskId } = params;
  let { body } = params;
  // Jira-style clients may send the description as ADF instead of HTML
  if (body.descriptionHtml === undefined && isAdfDoc(body.descriptionAdf)) {
    body = { ...body, descriptionHtml: adfToHtml(body.descriptionAdf) };
  }
  const actorId = session.user.id;
  const actorName = session.user.name || session.user.email || 'User';

  const existing = await assertProjectTask(companyId, projectId, taskId);
  if (!existing) return { ok: false, status: 404, error: 'Not found' };

  const data: Record<string, unknown> = {};
  const activities: ActivityRow[] = [];

  if (typeof body.title === 'string') {
    const title = body.title.trim();
    if (!title) return { ok: false, status: 400, error: 'Title required' };
    if (title !== existing.title) {
      data.title = title;
      activities.push({
        eventType: 'TITLE_UPDATED',
        description: `${actorName} updated the title`,
        metadata: { from: existing.title, to: title },
      });
    }
  }

  let mentionedInDescription: string[] = [];
  if (typeof body.descriptionHtml === 'string') {
    const descriptionHtml = sanitizeRichText(body.descriptionHtml);
    if (descriptionHtml !== (existing.descriptionHtml ?? '')) {
      data.descriptionHtml = descriptionHtml;
      data.description = stripHtmlToPreview(descriptionHtml);
      mentionedInDescription = newMentionIds(existing.descriptionHtml, descriptionHtml);
      activities.push({
        eventType: 'DESCRIPTION_UPDATED',
        description: `${actorName} updated the description`,
      });
    }
  } else if (typeof body.description === 'string') {
    data.description = body.description;
  }

  let statusChangedTo: string | undefined;
  if (typeof body.status === 'string' && body.status !== existing.status) {
    const settings = await getCompanyProjectTaskSettings(companyId);
    if (!isAllowedProjectTaskStatus(body.status, settings)) {
      return { ok: false, status: 400, error: 'Invalid status' };
    }
    statusChangedTo = body.status;
    data.status = body.status;
    activities.push({
      eventType: 'STATUS_CHANGED',
      description: `${actorName} changed status from ${existing.status} to ${body.status}`,
      metadata: { from: existing.status, to: body.status },
    });
  }

  if (
    typeof body.priority === 'string' &&
    (PROJECT_PRIORITIES as readonly string[]).includes(body.priority) &&
    body.priority !== existing.priority
  ) {
    data.priority = body.priority;
    activities.push({
      eventType: 'PRIORITY_CHANGED',
      description: `${actorName} changed priority from ${existing.priority} to ${body.priority}`,
      metadata: { from: existing.priority, to: body.priority },
    });
  }

  let assigneeChangedTo: string | null | undefined;
  if (body.assigneeId !== undefined) {
    const nextAssignee =
      typeof body.assigneeId === 'string' && body.assigneeId.trim()
        ? body.assigneeId.trim()
        : null;
    if (nextAssignee !== existing.assigneeId) {
      if (nextAssignee && !(await isCompanyStaff(companyId, nextAssignee))) {
        return {
          ok: false,
          status: 400,
          error: 'Assignee must be a member of this workspace',
        };
      }
      assigneeChangedTo = nextAssignee;
      data.assigneeId = nextAssignee;
      activities.push({
        eventType: 'ASSIGNEE_CHANGED',
        description: nextAssignee
          ? `${actorName} changed the assignee`
          : `${actorName} unassigned the task`,
        metadata: { from: existing.assigneeId, to: nextAssignee },
      });
    }
  }

  if (body.dueDate !== undefined) {
    const nextDue = body.dueDate ? new Date(body.dueDate as string) : null;
    if (nextDue && Number.isNaN(nextDue.getTime())) {
      return { ok: false, status: 400, error: 'Invalid due date' };
    }
    if ((nextDue?.getTime() ?? null) !== (existing.dueDate?.getTime() ?? null)) {
      data.dueDate = nextDue;
      activities.push({
        eventType: 'DUE_DATE_CHANGED',
        description: `${actorName} updated the due date`,
        metadata: {
          from: existing.dueDate?.toISOString() ?? null,
          to: nextDue?.toISOString() ?? null,
        },
      });
    }
  }

  if (typeof body.sortOrder === 'number' && Number.isFinite(body.sortOrder)) {
    data.sortOrder = Math.round(body.sortOrder);
  }

  if (Object.keys(data).length === 0) {
    return { ok: true, changed: false, task: existing, effects: async () => {} };
  }

  const task = await prisma.projectTask.update({
    where: { id: taskId },
    data,
    include: { assignee: { select: PERSON_SELECT }, reporter: { select: PERSON_SELECT } },
  });

  if (activities.length > 0) {
    await prisma.projectTaskActivity.createMany({
      data: activities.map((a) => ({
        taskId,
        actorId,
        eventType: a.eventType,
        description: a.description,
        ...(a.metadata ? { metadata: a.metadata as object } : {}),
      })),
    });
  }

  const progress = await syncProjectProgress(projectId, companyId);

  const effects = async () => {
    const notifications = await import('@/lib/projects/task-notifications');
    const notifyBase = {
      companyId,
      projectId,
      taskId,
      taskTitle: task.title,
      actorId,
      actorName,
    };

    if (assigneeChangedTo) {
      await notifications.notifyProjectTaskAssigned({
        ...notifyBase,
        assigneeId: assigneeChangedTo,
      });
    }

    if (mentionedInDescription.length > 0) {
      await notifications.notifyProjectMentions({
        companyId,
        projectId,
        actorId,
        actorName,
        mentionedIds: mentionedInDescription,
        target: { kind: 'task-description', taskId, title: task.title },
      });
    }

    if (statusChangedTo) {
      await notifications.notifyProjectTaskUpdated({
        ...notifyBase,
        summary: `status → ${statusChangedTo}`,
      });

      const { dispatchWorkflowEvent } = await import('@/lib/workflows/executor');
      await dispatchWorkflowEvent('project.task.status_changed', {
        userId: actorId,
        companyId,
        title: task.title,
        summary: `${actorName} changed status to ${statusChangedTo}`,
        metadata: {
          projectId,
          taskId,
          status: statusChangedTo,
          previousStatus: existing.status,
        },
      });
    }
  };

  return { ok: true, changed: true, task, progress, effects };
}
