import { prisma } from '@/lib/prisma';
import {
  ALL_FEATURE_MODULES,
  type FeatureModuleKey,
  type PlanModuleMap,
} from '@/lib/feature-module-keys';

export type { PlanModuleMap };

function baseMap(enabled: Partial<Record<FeatureModuleKey, boolean>>): PlanModuleMap {
  const map = Object.fromEntries(
    ALL_FEATURE_MODULES.map((m) => [m, false])
  ) as PlanModuleMap;
  for (const [key, value] of Object.entries(enabled)) {
    if (key in map) {
      map[key as FeatureModuleKey] = value === true;
    }
  }
  return map;
}

/** Default module entitlements when Plan.modules is not set in the database. */
export const DEFAULT_PLAN_MODULES: Record<string, Partial<Record<FeatureModuleKey, boolean>>> = {
  free: {
    LEADS: true,
    EMAIL_OUTREACH: true,
    TICKETS: true,
  },
  starter: {
    LEADS: true,
    EMAIL_OUTREACH: true,
    TICKETS: true,
    SUPPORT_LIVE_CHAT: true,
    SUPPORT_KNOWLEDGE: true,
    DEALS: true,
    QUOTATIONS: true,
    INVENTORY: true,
    WHATSAPP: true,
  },
  professional: {
    LEADS: true,
    DEALS: true,
    QUOTATIONS: true,
    INVOICES: true,
    TICKETS: true,
    SUPPORT_INBOX: true,
    SUPPORT_SLA: true,
    SUPPORT_LIVE_CHAT: true,
    SUPPORT_KNOWLEDGE: true,
    SUPPORT_CANNED: true,
    SUPPORT_GROUPS: true,
    TICKET_ADVANCED: true,
    INVENTORY: true,
    EQUIPMENT: true,
    SERVICE_REPORTS: true,
    SERVICE_CASH: true,
    SERVICE_EXPENSES: true,
    SERVICE_GPS: true,
    WHATSAPP: true,
    EMAIL_OUTREACH: true,
  },
  enterprise: Object.fromEntries(ALL_FEATURE_MODULES.map((m) => [m, true])) as Partial<
    Record<FeatureModuleKey, boolean>
  >,
};

export function parsePlanModules(
  planName: string,
  modulesJson: unknown
): PlanModuleMap {
  const defaults = DEFAULT_PLAN_MODULES[planName] ?? DEFAULT_PLAN_MODULES.free;
  const map = baseMap(defaults);

  if (modulesJson && typeof modulesJson === 'object' && !Array.isArray(modulesJson)) {
    const raw = modulesJson as Record<string, boolean>;
    for (const module of ALL_FEATURE_MODULES) {
      if (typeof raw[module] === 'boolean') {
        map[module] = raw[module];
      }
    }
  }

  return map;
}

export function isSubscriptionActive(subscription: {
  status: string;
  currentPeriodEnd: Date;
  trialEndsAt?: Date | null;
}): boolean {
  if (!['ACTIVE', 'TRIALING', 'PAST_DUE'].includes(subscription.status)) {
    return false;
  }
  if (subscription.status === 'TRIALING') {
    if (subscription.trialEndsAt) {
      return new Date() <= new Date(subscription.trialEndsAt);
    }
    return new Date() <= new Date(subscription.currentPeriodEnd);
  }
  return new Date() <= new Date(subscription.currentPeriodEnd);
}

/** Pick company billing owner: primary-company admin with best plan, else highest active plan. */
export async function resolveCompanyBillingUserId(
  companyId: string
): Promise<string | null> {
  const admins = await prisma.user.findMany({
    where: {
      OR: [{ companyId }, { primaryCompanyId: companyId }],
      role: { in: ['ADMIN', 'SUPER_ADMIN'] },
    },
    select: {
      id: true,
      createdAt: true,
      primaryCompanyId: true,
      subscription: {
        select: {
          status: true,
          currentPeriodEnd: true,
          trialEndsAt: true,
          plan: { select: { price: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  if (!admins.length) return null;

  const rank = (a: (typeof admins)[number]) => {
    const price =
      a.subscription && isSubscriptionActive(a.subscription)
        ? a.subscription.plan.price || 0
        : -1;
    const isPrimary = a.primaryCompanyId === companyId ? 1 : 0;
    return { price, isPrimary };
  };

  const sorted = [...admins].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    if (rb.price !== ra.price) return rb.price - ra.price;
    if (rb.isPrimary !== ra.isPrimary) return rb.isPrimary - ra.isPrimary;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  const withActive = sorted.find(
    (a) => a.subscription && isSubscriptionActive(a.subscription)
  );
  if (withActive) return withActive.id;

  const withSub = sorted.find((a) => a.subscription);
  return withSub?.id ?? sorted[0].id;
}

/**
 * Resolve which user's subscription controls feature access for a workspace member.
 * Company staff always inherit the company billing admin's plan (not personal Free trials).
 */
export async function resolveBillingUserId(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, companyId: true, primaryCompanyId: true },
  });
  if (!user) return userId;

  const companyId = user.companyId ?? user.primaryCompanyId;
  if (!companyId) {
    return userId;
  }

  // Non-admin staff never bill personally
  if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
    return (await resolveCompanyBillingUserId(companyId)) ?? userId;
  }

  const companyBillingId = await resolveCompanyBillingUserId(companyId);
  if (companyBillingId) return companyBillingId;

  return userId;
}

export async function getPlanModuleMapForUser(userId: string): Promise<PlanModuleMap> {
  const billingUserId = await resolveBillingUserId(userId);

  const subscription = await prisma.subscription.findUnique({
    where: { userId: billingUserId },
    include: { plan: true },
  });

  if (!subscription || !isSubscriptionActive(subscription)) {
    return parsePlanModules('free', null);
  }

  return parsePlanModules(subscription.plan.name, subscription.plan.modules);
}

export async function getPlanModuleMapForCompany(companyId: string): Promise<PlanModuleMap> {
  const billingUserId = await resolveCompanyBillingUserId(companyId);
  if (!billingUserId) {
    return parsePlanModules('free', null);
  }

  const subscription = await prisma.subscription.findUnique({
    where: { userId: billingUserId },
    include: { plan: true },
  });

  if (!subscription || !isSubscriptionActive(subscription)) {
    return parsePlanModules('free', null);
  }

  return parsePlanModules(subscription.plan.name, subscription.plan.modules);
}

