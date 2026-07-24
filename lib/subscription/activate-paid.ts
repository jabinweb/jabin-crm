import { prisma } from '@/lib/prisma';

/** Activate or upgrade a paid/manual subscription for a billing user. */
export async function activatePaidSubscription(input: {
  userId: string;
  planId: string;
  /** Default 30 days; use longer for complimentary admin grants */
  periodDays?: number;
  status?: 'ACTIVE' | 'TRIALING';
  trialEndsAt?: Date | null;
}) {
  const plan = await prisma.plan.findUnique({ where: { id: input.planId } });
  if (!plan) {
    throw new Error('Plan not found');
  }

  const periodDays = input.periodDays ?? 30;
  const periodEnd = new Date();
  periodEnd.setDate(periodEnd.getDate() + periodDays);
  const status = input.status ?? 'ACTIVE';

  const existing = await prisma.subscription.findUnique({
    where: { userId: input.userId },
  });

  if (existing) {
    await prisma.subscription.update({
      where: { userId: input.userId },
      data: {
        planId: plan.id,
        status,
        currentPeriodStart: new Date(),
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
        canceledAt: null,
        trialEndsAt: status === 'TRIALING' ? input.trialEndsAt ?? periodEnd : null,
      },
    });
  } else {
    await prisma.subscription.create({
      data: {
        userId: input.userId,
        planId: plan.id,
        status,
        currentPeriodEnd: periodEnd,
        trialEndsAt: status === 'TRIALING' ? input.trialEndsAt ?? periodEnd : null,
      },
    });
  }

  await prisma.usageTracking.upsert({
    where: { userId: input.userId },
    create: { userId: input.userId },
    update: {
      leadsCreated: 0,
      emailsSent: 0,
      campaignsCreated: 0,
      lastResetAt: new Date(),
    },
  });

  return { userId: input.userId, planId: plan.id, planName: plan.name };
}
