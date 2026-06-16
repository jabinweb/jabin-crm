import { prisma } from '@/lib/prisma';
import { resolveBillingUserId, isSubscriptionActive } from '@/lib/plan-modules';

export interface UsageLimits {
  canCreateLead: boolean;
  canSendEmail: boolean;
  canCreateCampaign: boolean;
  leadsRemaining: number;
  emailsRemaining: number;
  campaignsRemaining: number;
  currentUsage: {
    leadsCreated: number;
    emailsSent: number;
    campaignsCreated: number;
  };
  limits: {
    maxLeads: number;
    maxEmails: number;
    maxCampaigns: number;
  };
  billingUserId: string;
}

export async function checkUsageLimits(userId: string): Promise<UsageLimits> {
  const billingUserId = await resolveBillingUserId(userId);

  const subscription = await prisma.subscription.findUnique({
    where: { userId: billingUserId },
    include: { plan: true },
  });

  const usage = await prisma.usageTracking.findUnique({
    where: { userId: billingUserId },
  });

  const emptyLimits = (limits: { maxLeads: number; maxEmails: number; maxCampaigns: number }): UsageLimits => ({
    canCreateLead: false,
    canSendEmail: false,
    canCreateCampaign: false,
    leadsRemaining: 0,
    emailsRemaining: 0,
    campaignsRemaining: 0,
    currentUsage: {
      leadsCreated: usage?.leadsCreated || 0,
      emailsSent: usage?.emailsSent || 0,
      campaignsCreated: usage?.campaignsCreated || 0,
    },
    limits,
    billingUserId,
  });

  if (!subscription || !isSubscriptionActive(subscription)) {
    return emptyLimits({
      maxLeads: subscription?.plan.maxLeads ?? 0,
      maxEmails: subscription?.plan.maxEmails ?? 0,
      maxCampaigns: subscription?.plan.maxCampaigns ?? 0,
    });
  }

  const { plan } = subscription;
  const currentUsage = {
    leadsCreated: usage?.leadsCreated || 0,
    emailsSent: usage?.emailsSent || 0,
    campaignsCreated: usage?.campaignsCreated || 0,
  };

  const isUnlimited = (limit: number) => limit === -1;

  const canCreateLead =
    isUnlimited(plan.maxLeads) || currentUsage.leadsCreated < plan.maxLeads;
  const canSendEmail =
    isUnlimited(plan.maxEmails) || currentUsage.emailsSent < plan.maxEmails;
  const canCreateCampaign =
    isUnlimited(plan.maxCampaigns) ||
    currentUsage.campaignsCreated < plan.maxCampaigns;

  return {
    canCreateLead,
    canSendEmail,
    canCreateCampaign,
    leadsRemaining: isUnlimited(plan.maxLeads)
      ? -1
      : Math.max(0, plan.maxLeads - currentUsage.leadsCreated),
    emailsRemaining: isUnlimited(plan.maxEmails)
      ? -1
      : Math.max(0, plan.maxEmails - currentUsage.emailsSent),
    campaignsRemaining: isUnlimited(plan.maxCampaigns)
      ? -1
      : Math.max(0, plan.maxCampaigns - currentUsage.campaignsCreated),
    currentUsage,
    limits: {
      maxLeads: plan.maxLeads,
      maxEmails: plan.maxEmails,
      maxCampaigns: plan.maxCampaigns,
    },
    billingUserId,
  };
}

export async function incrementUsage(
  userId: string,
  type: 'leads' | 'emails' | 'campaigns',
  amount: number = 1
): Promise<void> {
  const billingUserId = await resolveBillingUserId(userId);

  const fieldMap = {
    leads: 'leadsCreated',
    emails: 'emailsSent',
    campaigns: 'campaignsCreated',
  };

  await prisma.usageTracking.upsert({
    where: { userId: billingUserId },
    create: {
      userId: billingUserId,
      [fieldMap[type]]: amount,
    },
    update: {
      [fieldMap[type]]: {
        increment: amount,
      },
    },
  });
}

export async function resetMonthlyUsage(userId: string): Promise<void> {
  const billingUserId = await resolveBillingUserId(userId);
  await prisma.usageTracking.update({
    where: { userId: billingUserId },
    data: {
      leadsCreated: 0,
      emailsSent: 0,
      campaignsCreated: 0,
      lastResetAt: new Date(),
    },
  });
}
