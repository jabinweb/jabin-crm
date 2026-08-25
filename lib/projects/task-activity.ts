import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

export type ProjectTaskEventType =
  | 'CREATED'
  | 'STATUS_CHANGED'
  | 'ASSIGNEE_CHANGED'
  | 'PRIORITY_CHANGED'
  | 'TITLE_UPDATED'
  | 'DESCRIPTION_UPDATED'
  | 'DUE_DATE_CHANGED'
  | 'COMMENT_ADDED'
  | 'ATTACHMENT_ADDED'
  | 'WATCHER_ADDED'
  | 'WATCHER_REMOVED';

export async function logProjectTaskActivity(params: {
  taskId: string;
  actorId?: string | null;
  eventType: ProjectTaskEventType | string;
  description: string;
  metadata?: Record<string, unknown> | null;
}) {
  return prisma.projectTaskActivity.create({
    data: {
      taskId: params.taskId,
      actorId: params.actorId || null,
      eventType: params.eventType,
      description: params.description,
      ...(params.metadata
        ? { metadata: params.metadata as Prisma.InputJsonValue }
        : {}),
    },
  });
}

export async function assertProjectTask(
  companyId: string,
  projectId: string,
  taskId: string
) {
  return prisma.projectTask.findFirst({
    where: {
      id: taskId,
      projectId,
      project: { companyId },
    },
    include: {
      project: { select: { id: true, companyId: true, name: true } },
      assignee: { select: { id: true, name: true, email: true, image: true } },
      reporter: { select: { id: true, name: true, email: true, image: true } },
    },
  });
}

export function stripHtmlToPreview(html: string | null | undefined, max = 160) {
  if (!html) return null;
  const text = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return null;
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
