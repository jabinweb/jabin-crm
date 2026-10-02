import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/api-error-handler';
import { guardTicketAccess } from '@/lib/api/module-guard';
import { isApiException } from '@/lib/api/subscription-guards';
import { requireTicketRouteAccess } from '@/lib/tenant/ticket-route-guard';

type Params = { params: Promise<{ id: string; activityId: string }> };

/** Replies and internal notes only — system activity (status changes, presence…) is history. */
const EDITABLE_TYPES = ['COMMENT', 'INTERNAL_NOTE'];

async function loadOwnComment(request: NextRequest, { params }: Params) {
  const { id, activityId } = await params;
  const session = await auth();
  await guardTicketAccess(session?.user);
  const guard = await requireTicketRouteAccess(session, request, id);
  if (!guard.ok) return { error: guard.response } as const;
  const activity = await prisma.ticketActivity.findFirst({
    where: { id: activityId, ticketId: id, eventType: { in: EDITABLE_TYPES } },
    select: { id: true, performedById: true, metadata: true },
  });
  if (!activity) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) } as const;
  }
  return { activity, session: guard.session } as const;
}

/** PATCH — edit your own reply / note. Marked as edited. */
export async function PATCH(request: NextRequest, context: Params) {
  try {
    const loaded = await loadOwnComment(request, context);
    if ('error' in loaded) return loaded.error;
    const { activity, session } = loaded;
    if (activity.performedById !== session.user.id) {
      return NextResponse.json({ error: 'You can only edit your own comments' }, { status: 403 });
    }
    const body = await request.json().catch(() => ({}));
    const text = typeof body.comment === 'string' ? body.comment.trim() : '';
    if (!text) return NextResponse.json({ error: 'Comment text is required' }, { status: 400 });

    const metadata =
      activity.metadata && typeof activity.metadata === 'object' && !Array.isArray(activity.metadata)
        ? (activity.metadata as Record<string, unknown>)
        : {};
    const updated = await prisma.ticketActivity.update({
      where: { id: activity.id },
      data: { description: text, metadata: { ...metadata, editedAt: new Date().toISOString() } },
    });
    return NextResponse.json(updated);
  } catch (error) {
    if (!isApiException(error)) console.error('Error editing ticket comment:', error);
    return handleApiError(error);
  }
}

/** DELETE — your own reply / note, or any for workspace admins. */
export async function DELETE(request: NextRequest, context: Params) {
  try {
    const loaded = await loadOwnComment(request, context);
    if ('error' in loaded) return loaded.error;
    const { activity, session } = loaded;
    const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(session.user.role ?? '');
    if (activity.performedById !== session.user.id && !isAdmin) {
      return NextResponse.json({ error: 'You can only delete your own comments' }, { status: 403 });
    }
    await prisma.ticketActivity.delete({ where: { id: activity.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (!isApiException(error)) console.error('Error deleting ticket comment:', error);
    return handleApiError(error);
  }
}
