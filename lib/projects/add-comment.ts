import type { Session } from 'next-auth';
import { prisma } from '@/lib/prisma';
import {
  assertProjectTask,
  logProjectTaskActivity,
  stripHtmlToPreview,
} from '@/lib/projects/task-activity';
import { isRichTextEmpty, sanitizeRichText } from '@/lib/html/sanitize-rich-text';
import { extractMentionIds } from '@/lib/projects/mentions';

type CommentAttachment = {
  url: string;
  name?: string;
  mimeType?: string;
  size?: number;
  fileId?: string;
};

export type CommentCreateResult =
  | { ok: false; status: number; error: string }
  | {
      ok: true;
      comment: { id: string; body: string; [key: string]: unknown };
      /** Mention + comment notifications — run after the response is sent. */
      effects: () => Promise<void>;
    };

/**
 * Single write path for commenting on a project task (task page and the OPS agent):
 * activity entry, auto-watch, mention and watcher notifications. Callers check access.
 */
export async function addProjectTaskComment(params: {
  session: Session;
  companyId: string;
  projectId: string;
  taskId: string;
  /** Rich-text HTML; sanitized here. */
  bodyHtml: string;
  attachments?: unknown[];
}): Promise<CommentCreateResult> {
  const { session, companyId, projectId, taskId } = params;
  const task = await assertProjectTask(companyId, projectId, taskId);
  if (!task) return { ok: false, status: 404, error: 'Not found' };

  const rawBody = sanitizeRichText(params.bodyHtml);
  if (isRichTextEmpty(rawBody)) return { ok: false, status: 400, error: 'Comment required' };

  const comment = await prisma.projectTaskComment.create({
    data: { taskId, authorId: session.user.id, body: rawBody },
    include: {
      author: { select: { id: true, name: true, email: true, image: true } },
    },
  });

  const attachments = (params.attachments ?? []).filter(
    (a): a is CommentAttachment =>
      !!a &&
      typeof (a as CommentAttachment).url === 'string' &&
      /^(https?:\/\/|\/(?!\/))/i.test((a as CommentAttachment).url)
  );
  if (attachments.length > 0) {
    await prisma.projectTaskAttachment.createMany({
      data: attachments.map((a) => ({
        taskId,
        commentId: comment.id,
        url: a.url,
        name: a.name || null,
        mimeType: a.mimeType || null,
        size: typeof a.size === 'number' ? a.size : null,
        fileId: a.fileId || null,
        uploadedById: session.user.id,
        source: 'COMMENT',
      })),
    });
  }

  const actorName = session.user.name || session.user.email || 'User';
  await logProjectTaskActivity({
    taskId,
    actorId: session.user.id,
    eventType: 'COMMENT_ADDED',
    description: `${actorName} added a comment`,
    metadata: { commentId: comment.id },
  });

  // Auto-watch commenter
  await prisma.projectTaskWatcher.upsert({
    where: { taskId_userId: { taskId, userId: session.user.id } },
    create: { taskId, userId: session.user.id },
    update: {},
  });

  const mentionedIds = extractMentionIds(rawBody);
  const excerpt = stripHtmlToPreview(rawBody, 240);
  const effects = async () => {
    const notifications = await import('@/lib/projects/task-notifications');
    const base = { companyId, projectId, actorId: session.user.id, actorName };
    // Mentions first: those people get the more specific notification only
    const mentioned = await notifications.notifyProjectMentions({
      ...base,
      mentionedIds,
      excerpt,
      target: { kind: 'task-comment', taskId, title: task.title },
    });
    await notifications.notifyProjectTaskCommented({
      ...base,
      taskId,
      taskTitle: task.title,
      excerpt,
      excludeUserIds: mentioned,
    });
  };

  return { ok: true, comment, effects };
}
