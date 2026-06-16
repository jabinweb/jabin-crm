import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { handleApiError } from '@/lib/api-error-handler';
import { getFeatureModuleMap, getPlanModulesForUser } from '@/lib/feature-modules';
import { prisma } from '@/lib/prisma';
import { resolveBillingUserId } from '@/lib/plan-modules';

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    const [modules, planModules, billingUserId] = await Promise.all([
      getFeatureModuleMap(session.user.id),
      getPlanModulesForUser(session.user.id),
      resolveBillingUserId(session.user.id),
    ]);

    const subscription = await prisma.subscription.findUnique({
      where: { userId: billingUserId },
      include: { plan: { select: { name: true, displayName: true } } },
    });

    return NextResponse.json({
      modules,
      planModules,
      subscription: subscription
        ? {
            status: subscription.status,
            plan: subscription.plan,
          }
        : null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
