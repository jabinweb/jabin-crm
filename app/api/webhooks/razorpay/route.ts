import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    const signature = req.headers.get('x-razorpay-signature')

    const secret = process.env.RAZORPAY_WEBHOOK_SECRET
    if (!secret) {
      console.error('[Webhook] Razorpay: RAZORPAY_WEBHOOK_SECRET is not set')
      return new Response('Server misconfigured', { status: 500 })
    }

    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex')

    if (signature !== expectedSignature) {
      return new Response('Invalid signature', { status: 400 })
    }

    const event = JSON.parse(body)

    // Handle different event types
    switch (event.event) {
      case 'payment.captured':
        await handlePaymentSuccess(event.payload.payment.entity)
        break
      case 'payment.failed':
        await handlePaymentFailure(event.payload.payment.entity)
        break
    }

    return new Response('Webhook processed', { status: 200 })
  } catch (error) {
    console.error('[Webhook] Razorpay error:', error)
    return new Response('Webhook processing failed', { status: 500 })
  }
}

async function handlePaymentSuccess(payment: {
  notes?: { payslipId?: string; userId?: string; planId?: string }
  id?: string
  order_id?: string
}) {
  const payslipId = payment.notes?.payslipId
  const planId = payment.notes?.planId
  const userId = payment.notes?.userId

  if (planId && userId && payment.order_id && payment.id) {
    try {
      const pending = await prisma.payment.findFirst({
        where: { razorpayOrderId: payment.order_id, status: 'PENDING' },
      })

      if (pending) {
        // Webhook path — signature verified at webhook level; use stored payment record
        await prisma.payment.updateMany({
          where: { razorpayOrderId: payment.order_id },
          data: {
            status: 'CAPTURED',
            razorpayPaymentId: payment.id,
          },
        })

        const periodEnd = new Date()
        periodEnd.setDate(periodEnd.getDate() + 30)

        const existingSubscription = await prisma.subscription.findUnique({ where: { userId } })

        if (existingSubscription) {
          await prisma.subscription.update({
            where: { userId },
            data: {
              planId,
              status: 'ACTIVE',
              currentPeriodStart: new Date(),
              currentPeriodEnd: periodEnd,
              cancelAtPeriodEnd: false,
              trialEndsAt: null,
            },
          })
        } else {
          await prisma.subscription.create({
            data: {
              userId,
              planId,
              status: 'ACTIVE',
              currentPeriodEnd: periodEnd,
            },
          })
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
        })
      }
    } catch (error) {
      console.error('[Webhook] Subscription activation failed:', error)
    }
    return
  }

  if (!payslipId) {
    console.error('[Webhook] Razorpay payment.captured: unhandled payment', {
      paymentId: payment.id,
    })
    return
  }

  await prisma.payslip.update({
    where: { id: payslipId },
    data: {
      isPaid: true,
      paidAt: new Date(),
    },
  })
}

async function handlePaymentFailure(payment: {
  notes?: { payslipId?: string }
  id?: string
  error_description?: string
}) {
  const payslipId = payment.notes?.payslipId
  console.error('[Webhook] Razorpay payment.failed:', {
    payslipId,
    paymentId: payment.id,
    failureReason: payment.error_description,
  })
  // Payslip has no JSON metadata column; do not persist failure on the row.
  if (!payslipId) return
}
