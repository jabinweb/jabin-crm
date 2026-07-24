import { prisma } from '@/lib/prisma';
import { PLAN_CATALOG, PLAN_LIST_PRICES_PAISE } from '@/lib/pricing/catalog';
import {
  DEFAULT_PLAN_MODULES,
  resolveCompanyBillingUserId,
} from '@/lib/plan-modules';

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
 * Whether this user may start a personal Free trial.
 * Company staff inherit the company billing plan — no personal trials.
 */
export async function canActivatePersonalFreeTrial(userId: string): Promise<{
  ok: boolean;
  reason?: string;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, companyId: true, primaryCompanyId: true },
  });
  if (!user) return { ok: false, reason: 'User not found' };

  const companyId = user.companyId ?? user.primaryCompanyId;
  if (!companyId) return { ok: true };

  if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
    return {
      ok: false,
      reason: 'Your workspace plan is managed by the company admin',
    };
  }

  const billingId = await resolveCompanyBillingUserId(companyId);
  if (billingId && billingId !== userId) {
    const billingSub = await prisma.subscription.findUnique({
      where: { userId: billingId },
      select: { id: true },
    });
    if (billingSub) {
      return {
        ok: false,
        reason: 'This workspace already has a billing account',
      };
    }
  }

  return { ok: true };
}

/**
 * Attach a 14-day TRIALING free subscription to a billing user if they have none.
 */
export async function ensureFreeTrialSubscription(userId: string) {
  const existing = await prisma.subscription.findUnique({
    where: { userId },
  });
  if (existing) return existing;

  const allowed = await canActivatePersonalFreeTrial(userId);
  if (!allowed.ok) {
    throw new Error(allowed.reason || 'Free trial not available for this account');
  }

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

/** Remove leftover personal Free trials for users who are not their company's billing owner. */
export async function pruneNonBillingFreeTrials() {
  const freePlan = await prisma.plan.findUnique({ where: { name: 'free' } });
  if (!freePlan) return { deleted: 0 };

  const candidates = await prisma.subscription.findMany({
    where: {
      planId: freePlan.id,
      status: { in: ['TRIALING', 'ACTIVE'] },
      user: {
        OR: [{ companyId: { not: null } }, { primaryCompanyId: { not: null } }],
      },
    },
    select: {
      id: true,
      userId: true,
      user: { select: { companyId: true, primaryCompanyId: true, role: true } },
    },
  });

  let deleted = 0;
  for (const row of candidates) {
    const companyId = row.user.companyId ?? row.user.primaryCompanyId;
    if (!companyId) continue;

    if (row.user.role !== 'ADMIN' && row.user.role !== 'SUPER_ADMIN') {
      await prisma.subscription.delete({ where: { id: row.id } });
      deleted += 1;
      continue;
    }

    const billingId = await resolveCompanyBillingUserId(companyId);
    if (billingId && billingId !== row.userId) {
      await prisma.subscription.delete({ where: { id: row.id } });
      deleted += 1;
    }
  }

  return { deleted };
}
