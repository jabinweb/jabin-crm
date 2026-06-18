import { NextResponse } from 'next/server';
import { getFeatureModuleMap, getPlanModulesForUser } from '@/lib/feature-modules';
import { prisma } from '@/lib/prisma';
import { resolveBillingUserId } from '@/lib/plan-modules';
import { withSessionRoute, jsonOk } from '@/lib/api/with-route';

export const GET = withSessionRoute(async (_req, { userId }) => {
  const [modules, planModules, billingUserId] = await Promise.all([
    getFeatureModuleMap(userId),
    getPlanModulesForUser(userId),
    resolveBillingUserId(userId),
  ]);

  const subscription = await prisma.subscription.findUnique({
    where: { userId: billingUserId },
    include: { plan: { select: { name: true, displayName: true } } },
  });

  return jsonOk({
    modules,
    planModules,
    subscription: subscription
      ? {
          status: subscription.status,
          plan: subscription.plan,
        }
      : null,
  });
});
