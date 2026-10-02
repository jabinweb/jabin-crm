import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { assertLiveChatEnabled, isApiException } from '@/lib/api/subscription-guards';
import { handleApiError } from '@/lib/api-error-handler';
import { userHasCompanyAccess } from '@/lib/auth/company-membership';
import type { Session } from 'next-auth';

async function isChatAgentForCompany(
  sessionAuth: Session | null,
  companyId: string | null
): Promise<boolean> {
  const user = sessionAuth?.user;
  if (!user?.id || user.role === 'CUSTOMER') return false;
  if (user.role === 'SUPER_ADMIN') return true;
  if (!companyId) return false;
  return userHasCompanyAccess(user.id, companyId);
}

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
    // Staff only count as agents for sessions in a workspace they belong to.
    const isAgent = await isChatAgentForCompany(sessionAuth, session.companyId);

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