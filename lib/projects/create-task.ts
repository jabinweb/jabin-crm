import type { Session } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { PROJECT_PRIORITIES } from '@/lib/projects/task-board';
import { isAllowedProjectTaskStatus } from '@/lib/projects/task-statuses';
import { logProjectTaskActivity } from '@/lib/projects/task-activity';
import {
  getCompanyProjectTaskSettings,
  syncProjectProgress,
} from '@/lib/projects/sync-project-progress';
import { sanitizeRichText } from '@/lib/html/sanitize-rich-text';
import { extractMentionIds, isCompanyStaff } from '@/lib/projects/mentions';

export type TaskCreateResult =
  | { ok: false; status: number; error: string }
  | {
      ok: true;
      task: {
        id: string;
        title: string;
        status: string;
        priority: string;
        assigneeId: string | null;
        [key: string]: unknown;
      };
      progress: number;
      /** Notifications / workflow events — run after the response is sent. */
      effects: () => Promise<void>;
    };

/**
 * Single write path for creating a project task (board, task page and the OPS agent),
 * so every task gets the same activity entry, watcher, progress update and notifications.
 * Callers check write access first.
 */
export async function createProjectTask(params: {
  session: Session;
  companyId: string;
  projectId: string;
  body: Record<string, unknown>;
}): Promise<TaskCreateResult> {
  const { session, companyId, projectId, body } = params;

  const project = await prisma.project.findFirst({
    where: { id: projectId, companyId },
    select: { id: true },
  });
  if (!project) return { ok: false, status: 404, error: 'Not found' };

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title) return { ok: false, status: 400, error: 'Title required' };

  const settings = await getCompanyProjectTaskSettings(companyId);
  const status =
    typeof body.status === 'string' && isAllowedProjectTaskStatus(body.status, settings)
      ? body.status
      : 'TODO';
  const priority =
    typeof body.priority === 'string' &&
    (PROJECT_PRIORITIES as readonly string[]).includes(body.priority)
      ? body.priority
      : 'MEDIUM';

  const max = await prisma.projectTask.aggregate({
    where: { projectId, status },
    _max: { sortOrder: true },
  });

  let parentTaskId: string | null = null;
  if (typeof body.parentTaskId === 'string' && body.parentTaskId.trim()) {
    const parent = await prisma.projectTask.findFirst({
      where: { id: body.parentTaskId.trim(), projectId },
      select: { id: true, parentTaskId: true, title: true },
    });
    if (!parent) return { ok: false, status: 400, error: 'Parent task not found' };
    // One level only (no nested subtasks)
    if (parent.parentTaskId) {
      return { ok: false, status: 400, error: 'Cannot add subtasks to a subtask' };
    }
    parentTaskId = parent.id;
  }

  const descriptionHtml =
    typeof body.descriptionHtml === 'string' ? sanitizeRichText(body.descriptionHtml) : null;

  const assigneeId =
    typeof body.assigneeId === 'string' && body.assigneeId.trim()
      ? body.assigneeId.trim()
      : null;
  if (assigneeId && !(await isCompanyStaff(companyId, assigneeId))) {
    return { ok: false, status: 400, error: 'Assignee must be a member of this workspace' };
  }

  const dueDate = body.dueDate ? new Date(String(body.dueDate)) : null;
  if (dueDate && Number.isNaN(dueDate.getTime())) {
    return { ok: false, status: 400, error: 'Invalid due date' };
  }
  const description =
    typeof body.description === 'string'
      ? body.description
      : descriptionHtml
        ? descriptionHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160)
        : null;

  const task = await prisma.projectTask.create({
    data: {
      projectId,
      parentTaskId,
      title,
      description,
      descriptionHtml,
      status,
      priority,
      reporterId: session.user.id,
      assigneeId,
      dueDate,
      sortOrder: (max._max.sortOrder ?? -1) + 1,
    },
    include: {
      assignee: { select: { id: true, name: true, email: true, image: true } },
      reporter: { select: { id: true, name: true, email: true, image: true } },
    },
  });

  const actorName = session.user.name || session.user.email || 'User';
  await logProjectTaskActivity({
    taskId: task.id,
    actorId: session.user.id,
    eventType: 'CREATED',
    description: parentTaskId ? `${actorName} created subtask` : `${actorName} created this task`,
  });

  if (parentTaskId) {
    await logProjectTaskActivity({
      taskId: parentTaskId,
      actorId: session.user.id,
      eventType: 'SUBTASK_ADDED',
      description: `${actorName} added subtask “${task.title}”`,
      metadata: { subtaskId: task.id },
    });
  }

  await prisma.projectTaskWatcher.upsert({
    where: { taskId_userId: { taskId: task.id, userId: session.user.id } },
    create: { taskId: task.id, userId: session.user.id },
    update: {},
  });

  const progress = await syncProjectProgress(projectId, companyId);
  const mentionedIds = extractMentionIds(descriptionHtml);

  const effects = async () => {
    const notifications = await import('@/lib/projects/task-notifications');
    if (task.assigneeId) {
      await notifications.notifyProjectTaskAssigned({
        companyId,
        projectId,
        taskId: task.id,
        taskTitle: task.title,
        actorId: session.user.id,
        actorName,
        assigneeId: task.assigneeId,
      });
    }
    if (mentionedIds.length > 0) {
      await notifications.notifyProjectMentions({
        companyId,
        projectId,
        actorId: session.user.id,
        actorName,
        mentionedIds,
        target: { kind: 'task-description', taskId: task.id, title: task.title },
      });
    }

    const { dispatchWorkflowEvent } = await import('@/lib/workflows/executor');
    await dispatchWorkflowEvent('project.task.created', {
      userId: session.user.id,
      companyId,
      title: task.title,
      summary: `${actorName} created “${task.title}”`,
      metadata: { projectId, taskId: task.id, status: task.status, priority: task.priority },
    });
  };

  return { ok: true, task, progress, effects };
}
