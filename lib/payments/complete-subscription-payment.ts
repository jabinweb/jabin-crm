import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

export function getRazorpayKeySecret(): string | null {
  const env = process.env.RAZORPAY_ENV || 'test';
  return env === 'production'
    ? process.env.RAZORPAY_LIVE_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET || null
    : process.env.RAZORPAY_TEST_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET || null;
}

export function verifyRazorpayPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string
): boolean {
  const keySecret = getRazorpayKeySecret();
  if (!keySecret) return false;

  const body = `${orderId}|${paymentId}`;
  const expected = crypto.createHmac('sha256', keySecret).update(body).digest('hex');
  return expected === signature;
}

export async function completeSubscriptionPayment(input: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  userId?: string;
  planId?: string;
}) {
  const keySecret = getRazorpayKeySecret();
  if (!keySecret) {
    throw new Error('Payment gateway secret is not configured');
  }

  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = input;

  if (!verifyRazorpayPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature)) {
    throw new Error('Invalid payment signature');
  }

  const pendingPayment = await prisma.payment.findFirst({
    where: {
      razorpayOrderId: razorpayOrderId,
      ...(input.userId ? { userId: input.userId } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!pendingPayment) {
    throw new Error('Payment record not found');
  }

  if (input.userId && pendingPayment.userId !== input.userId) {
    throw new Error('Payment does not belong to this user');
  }

  const userId = pendingPayment.userId;
  const resolvedPlanId = input.planId || pendingPayment.planId;

  if (!resolvedPlanId) {
    throw new Error('Plan ID is required');
  }

  if (input.planId && pendingPayment.planId && pendingPayment.planId !== input.planId) {
    throw new Error('Plan mismatch');
  }

  const plan = await prisma.plan.findUnique({ where: { id: resolvedPlanId } });
  if (!plan) {
    throw new Error('Plan not found');
  }

  // Idempotent — already processed
  if (pendingPayment.status === 'CAPTURED' && pendingPayment.razorpayPaymentId === razorpayPaymentId) {
    return { userId, planId: plan.id, alreadyProcessed: true };
  }

  await prisma.payment.updateMany({
    where: { razorpayOrderId: razorpayOrderId },
    data: {
      status: 'CAPTURED',
      razorpayPaymentId: razorpayPaymentId,
      razorpaySignature: razorpaySignature,
    },
  });

  const periodEnd = new Date();
  periodEnd.setDate(periodEnd.getDate() + 30);

  const existingSubscription = await prisma.subscription.findUnique({
    where: { userId },
  });

  if (existingSubscription) {
    await prisma.subscription.update({
      where: { userId },
      data: {
        planId: plan.id,
        status: 'ACTIVE',
        currentPeriodStart: new Date(),
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
        trialEndsAt: null,
      },
    });
  } else {
    await prisma.subscription.create({
      data: {
        userId,
        planId: plan.id,
        status: 'ACTIVE',
        currentPeriodEnd: periodEnd,
      },
    });
  }

  await prisma.usageTracking.upsert({
    where: { userId },
    create: { userId },
    update: {
      leadsCreated: 0,
      emailsSent: 0,
      campaignsCreated: 0,
      lastResetAt: new Date(),
    },
  });

  return { userId, planId: plan.id, alreadyProcessed: false };
}
