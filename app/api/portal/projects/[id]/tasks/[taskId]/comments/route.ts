import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { resolvePortalDataAccess } from '@/lib/api/portal-access';

/**
 * POST /api/portal/projects/[id]/tasks/[taskId]/comments
 * Customer opt-in comment on a delivery task for their project.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const session = await auth();
    const access = resolvePortalDataAccess(session);
    if (!access.ok || access.scope !== 'customer') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId, taskId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const text =
      typeof body.body === 'string'
        ? body.body.trim()
        : typeof body.comment === 'string'
          ? body.comment.trim()
          : '';

    if (!text) {
      return NextResponse.json({ error: 'Comment required' }, { status: 400 });
    }

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        customerId: access.customerId,
        status: { not: 'CANCELLED' },
      },
      select: { id: true },
    });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const task = await prisma.projectTask.findFirst({
      where: { id: taskId, projectId: project.id },
      select: { id: true },
    });
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const comment = await prisma.projectTaskComment.create({
      data: {
        taskId: task.id,
        authorId: session!.user.id,
        body: text.slice(0, 4000),
      },
      include: {
        author: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    console.error('[api/portal/projects/.../comments POST]', error);
    return NextResponse.json({ error: 'Failed to add comment' }, { status: 500 });
  }
}
