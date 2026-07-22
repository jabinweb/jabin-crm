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
  if (modulesJson && typeof modulesJson === 'object' && !Array.isArray(modulesJson)) {
    const raw = modulesJson as Record<string, boolean>;
    const map = baseMap({});
    for (const module of ALL_FEATURE_MODULES) {
      if (typeof raw[module] === 'boolean') {
        map[module] = raw[module];
      }
    }
    return map;
  }

  const defaults = DEFAULT_PLAN_MODULES[planName] ?? DEFAULT_PLAN_MODULES.free;
  return baseMap(defaults);
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

/** Resolve which user's subscription controls feature access for a workspace member. */
export async function resolveBillingUserId(userId: string): Promise<string> {
  const ownSub = await prisma.subscription.findUnique({
    where: { userId },
    select: { status: true, currentPeriodEnd: true },
  });

  if (ownSub && isSubscriptionActive(ownSub)) {
    return userId;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { companyId: true, primaryCompanyId: true },
  });

  const companyId = user?.companyId ?? user?.primaryCompanyId;
  if (!companyId) {
    return userId;
  }

  const adminWithSub = await prisma.user.findFirst({
    where: {
      OR: [{ companyId }, { primaryCompanyId: companyId }],
      role: { in: ['ADMIN', 'SUPER_ADMIN'] },
      subscription: {
        status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] },
      },
    },
    select: { id: true, subscription: { select: { status: true, currentPeriodEnd: true } } },
    orderBy: { createdAt: 'asc' },
  });

  if (adminWithSub?.subscription && isSubscriptionActive(adminWithSub.subscription)) {
    return adminWithSub.id;
  }

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
  const adminWithSub = await prisma.user.findFirst({
    where: {
      OR: [{ companyId }, { primaryCompanyId: companyId }],
      role: { in: ['ADMIN', 'SUPER_ADMIN'] },
      subscription: {
        status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] },
      },
    },
    include: { subscription: { include: { plan: true } } },
    orderBy: { createdAt: 'asc' },
  });

  if (
    adminWithSub?.subscription &&
    isSubscriptionActive(adminWithSub.subscription)
  ) {
    return parsePlanModules(
      adminWithSub.subscription.plan.name,
      adminWithSub.subscription.plan.modules
    );
  }

  return parsePlanModules('free', null);
}
