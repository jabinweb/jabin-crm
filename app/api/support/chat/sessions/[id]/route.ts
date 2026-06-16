import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { assertLiveChatEnabled, isApiException } from '@/lib/api/subscription-guards';
import { handleApiError } from '@/lib/api-error-handler';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const visitorToken = searchParams.get('visitorToken');

    const session = await prisma.liveChatSession.findUnique({
      where: { id },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        ticket: { select: { id: true, status: true } },
      },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const sessionAuth = await auth();
    const isAgent = sessionAuth?.user && sessionAuth.user.role !== 'CUSTOMER';

    await assertLiveChatEnabled({
      companyId: session.companyId,
      userId: isAgent ? sessionAuth?.user?.id : null,
    });

    if (!isAgent && visitorToken !== session.visitorToken) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(session);
  } catch (error) {
    if (isApiException(error)) return handleApiError(error);
    console.error('[api/support/chat/sessions/[id] GET]', error);
    return NextResponse.json({ error: 'Failed to load session' }, { status: 500 });
  }
}