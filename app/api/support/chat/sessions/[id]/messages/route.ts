import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { addChatMessage } from '@/lib/crm/live-chat-service';
import { assertLiveChatEnabled, isApiException } from '@/lib/api/subscription-guards';
import { handleApiError } from '@/lib/api-error-handler';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const sessionAuth = await auth();

    const session = await prisma.liveChatSession.findUnique({ where: { id } });
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const isAgent =
      sessionAuth?.user &&
      sessionAuth.user.role !== 'CUSTOMER';

    await assertLiveChatEnabled({
      companyId: session.companyId,
      userId: isAgent ? sessionAuth?.user?.id : null,
    });

    if (!isAgent && body.visitorToken !== session.visitorToken) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!body.body?.trim()) {
      return NextResponse.json({ error: 'Message body required' }, { status: 400 });
    }

    const message = await addChatMessage({
      sessionId: id,
      sender: isAgent ? 'agent' : 'visitor',
      senderId: sessionAuth?.user?.id,
      body: body.body.trim(),
    });

    await prisma.liveChatSession.update({
      where: { id },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    if (isApiException(error)) return handleApiError(error);
    console.error('[api/support/chat/sessions/[id]/messages POST]', error);    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
