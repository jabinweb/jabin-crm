import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { activatePaidSubscription } from '@/lib/subscription/activate-paid';

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

  // Idempotent — already processed
  if (pendingPayment.status === 'CAPTURED' && pendingPayment.razorpayPaymentId === razorpayPaymentId) {
    return { userId, planId: resolvedPlanId, alreadyProcessed: true };
  }

  await prisma.payment.updateMany({
    where: { razorpayOrderId: razorpayOrderId },
    data: {
      status: 'CAPTURED',
      razorpayPaymentId: razorpayPaymentId,
      razorpaySignature: razorpaySignature,
    },
  });

  await activatePaidSubscription({
    userId,
    planId: resolvedPlanId,
    periodDays: 30,
    status: 'ACTIVE',
  });

  return { userId, planId: resolvedPlanId, alreadyProcessed: false };
}
