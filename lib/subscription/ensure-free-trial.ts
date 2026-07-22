import { prisma } from '@/lib/prisma';
import { PLAN_CATALOG, PLAN_LIST_PRICES_PAISE } from '@/lib/pricing/catalog';
import { DEFAULT_PLAN_MODULES } from '@/lib/plan-modules';

/** Ensure the Free plan row exists (idempotent). */
export async function ensureFreePlan() {
  const catalog = PLAN_CATALOG.free;
  const price = PLAN_LIST_PRICES_PAISE.free ?? catalog.pricePaise;
  const modules = DEFAULT_PLAN_MODULES.free ?? {};

  return prisma.plan.upsert({
    where: { name: 'free' },
    create: {
      name: catalog.name,
      displayName: catalog.displayName,
      description: catalog.description,
      price,
      currency: 'INR',
      interval: catalog.interval,
      maxLeads: catalog.maxLeads,
      maxEmails: catalog.maxEmails,
      maxCampaigns: catalog.maxCampaigns,
      features: [...catalog.features],
      modules,
      isActive: true,
    },
    update: {
      displayName: catalog.displayName,
      description: catalog.description,
      price,
      features: [...catalog.features],
      modules,
      isActive: true,
    },
  });
}

/**
 * Attach a 14-day TRIALING free subscription to a billing user if they have none.
 */
export async function ensureFreeTrialSubscription(userId: string) {
  const existing = await prisma.subscription.findUnique({
    where: { userId },
  });
  if (existing) return existing;

  const freePlan = await ensureFreePlan();
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 14);
  const periodEnd = new Date();
  periodEnd.setDate(periodEnd.getDate() + 30);

  const subscription = await prisma.subscription.create({
    data: {
      userId,
      planId: freePlan.id,
      status: 'TRIALING',
      currentPeriodEnd: periodEnd,
      trialEndsAt,
    },
  });

  await prisma.usageTracking.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });

  return subscription;
}
