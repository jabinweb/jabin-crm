import { NextRequest, NextResponse } from 'next/server';
import { isFeatureEnabledForCompany } from '@/lib/feature-modules';
import { prisma } from '@/lib/prisma';
import { parsePlanModules, isSubscriptionActive } from '@/lib/plan-modules';

async function isLiveChatEnabledGlobally(): Promise<boolean> {
  const subscription = await prisma.subscription.findFirst({
    where: { status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] } },
    include: { plan: true },
    orderBy: { createdAt: 'desc' },
  });

  if (!subscription || !isSubscriptionActive(subscription)) {
    return false;
  }

  const modules = parsePlanModules(subscription.plan.name, subscription.plan.modules);
  return modules.SUPPORT_LIVE_CHAT === true;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get('companyId') ?? undefined;

  if (companyId) {
    const enabled = await isFeatureEnabledForCompany(companyId, 'SUPPORT_LIVE_CHAT');
    return NextResponse.json({ enabled });
  }

  const enabled = await isLiveChatEnabledGlobally();
  return NextResponse.json({ enabled });
}
