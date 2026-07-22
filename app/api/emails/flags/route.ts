import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

function metaOf(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return { ...(raw as Record<string, unknown>) };
  }
  return {};
}

/** Soft-delete (trash) or star/unstar an email log via metadata. */
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const emailId = typeof body.emailId === 'string' ? body.emailId : '';
    const action = typeof body.action === 'string' ? body.action : '';
    if (!emailId || !action) {
      return NextResponse.json({ error: 'emailId and action required' }, { status: 400 });
    }

    const email = await prisma.emailLog.findFirst({
      where: { id: emailId, userId: session.user.id },
    });
    if (!email) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 });
    }

    const meta = metaOf(email.metadata);

    if (action === 'trash') {
      meta.trashed = true;
      meta.trashedAt = new Date().toISOString();
    } else if (action === 'restore') {
      delete meta.trashed;
      delete meta.trashedAt;
    } else if (action === 'star') {
      meta.starred = true;
    } else if (action === 'unstar') {
      delete meta.starred;
    } else if (action === 'delete_forever') {
      await prisma.emailLog.delete({ where: { id: emailId } });
      return NextResponse.json({ success: true, deleted: true });
    } else {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    await prisma.emailLog.update({
      where: { id: emailId },
      data: { metadata: meta as Prisma.InputJsonValue },
    });

    return NextResponse.json({ success: true, metadata: meta });
  } catch (error) {
    console.error('[emails/flags]', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
