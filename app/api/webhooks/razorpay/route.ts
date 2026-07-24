import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { activatePaidSubscription } from '@/lib/subscription/activate-paid';

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get('x-razorpay-signature');

    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
      console.error('[Webhook] Razorpay: RAZORPAY_WEBHOOK_SECRET is not set');
      return new Response('Server misconfigured', { status: 500 });
    }

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');

    if (signature !== expectedSignature) {
      return new Response('Invalid signature', { status: 400 });
    }

    const event = JSON.parse(body);

    switch (event.event) {
      case 'payment.captured':
        await handlePaymentSuccess(event.payload.payment.entity);
        break;
      case 'payment.failed':
        await handlePaymentFailure(event.payload.payment.entity);
        break;
    }

    return new Response('Webhook processed', { status: 200 });
  } catch (error) {
    console.error('[Webhook] Razorpay error:', error);
    return new Response('Webhook processing failed', { status: 500 });
  }
}

async function handlePaymentSuccess(payment: {
  notes?: { payslipId?: string; userId?: string; planId?: string };
  id?: string;
  order_id?: string;
}) {
  const payslipId = payment.notes?.payslipId;
  const planId = payment.notes?.planId;
  const userId = payment.notes?.userId;

  if (planId && userId && payment.order_id && payment.id) {
    try {
      const pending = await prisma.payment.findFirst({
        where: { razorpayOrderId: payment.order_id },
      });

      if (!pending) {
        console.error('[Webhook] No payment row for order', payment.order_id);
        return;
      }

      if (pending.status === 'CAPTURED') {
        // Browser callback already activated — idempotent
        return;
      }

      await prisma.payment.updateMany({
        where: { razorpayOrderId: payment.order_id },
        data: {
          status: 'CAPTURED',
          razorpayPaymentId: payment.id,
        },
      });

      await activatePaidSubscription({
        userId: pending.userId,
        planId: pending.planId || planId,
        periodDays: 30,
        status: 'ACTIVE',
      });
    } catch (error) {
      console.error('[Webhook] Subscription activation failed:', error);
    }
    return;
  }

  if (!payslipId) {
    console.error('[Webhook] Razorpay payment.captured: unhandled payment', {
      paymentId: payment.id,
    });
    return;
  }

  await prisma.payslip.update({
    where: { id: payslipId },
    data: {
      isPaid: true,
      paidAt: new Date(),
    },
  });
}

async function handlePaymentFailure(payment: {
  notes?: { payslipId?: string };
  id?: string;
  error_description?: string;
}) {
  const payslipId = payment.notes?.payslipId;
  console.error('[Webhook] Razorpay payment.failed:', {
    payslipId,
    paymentId: payment.id,
    failureReason: payment.error_description,
  });
  if (!payslipId) return;
}
