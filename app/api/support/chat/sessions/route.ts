import { handleRouteError } from '@/lib/api/tenant-response';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getOrCreateChatSession, listOpenChatSessions } from '@/lib/crm/live-chat-service';
import {
  resolveCompanyContextFromRequest,
  TenantError,
} from '@/lib/auth/company-membership';
import { ensureFeatureEnabled, ensureFeatureEnabledForCompany } from '@/lib/feature-modules';
import { handleApiError } from '@/lib/api-error-handler';
import { parsePlanModules } from '@/lib/plan-modules';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await ensureFeatureEnabled(session.user.id, 'SUPPORT_LIVE_CHAT');

    let companyId: string | undefined;
    try {
      const ctx = await resolveCompanyContextFromRequest(session, request);
      companyId = ctx.companyId;
    } catch (e) {
      if (!(e instanceof TenantError) || e.status !== 400) throw e;
    }

    if (session.user.role === 'CUSTOMER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!companyId && session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Company context required' }, { status: 400 });
    }

    const sessions = await listOpenChatSessions(companyId);
    return NextResponse.json({ sessions });
  } catch (error) {
    console.error('[api/support/chat/sessions GET]', error);
    return NextResponse.json({ error: 'Failed to load chat sessions' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const body = await request.json();

    if (body.companyId) {
      await ensureFeatureEnabledForCompany(body.companyId, 'SUPPORT_LIVE_CHAT');
    } else if (session?.user?.id) {
      await ensureFeatureEnabled(session.user.id, 'SUPPORT_LIVE_CHAT');
    } else {
      const subscription = await prisma.subscription.findFirst({
        where: { status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] } },
        include: { plan: true },
        orderBy: { createdAt: 'desc' },
      });
      const modules = subscription?.plan
        ? parsePlanModules(subscription.plan.name, subscription.plan.modules)
        : parsePlanModules('free', null);
      if (modules.SUPPORT_LIVE_CHAT !== true) {
        return NextResponse.json({ error: 'Live chat is not available' }, { status: 403 });
      }
    }

    const session_ = await getOrCreateChatSession({
      visitorToken: body.visitorToken,
      visitorName: body.visitorName ?? session?.user?.name,
      visitorEmail: body.visitorEmail ?? session?.user?.email ?? undefined,
      // Never trust a client-supplied customerId — it links the chat (and its auto-ticket) to that account.
      customerId: session?.user?.role === 'CUSTOMER' ? session.user.customerId ?? undefined : undefined,
      companyId: body.companyId,
    });

    return NextResponse.json(session_, { status: session_.messages?.length ? 200 : 201 });
  } catch (error) {
    console.error('[api/support/chat/sessions POST]', error);
    return NextResponse.json({ error: 'Failed to start chat' }, { status: 500 });
  }
}
