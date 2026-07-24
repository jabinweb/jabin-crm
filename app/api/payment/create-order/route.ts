import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { razorpay } from '@/lib/razorpay';
import { getRequestLocation } from '@/lib/geo/request-location';
import { localizePlanPrice } from '@/lib/pricing/ppp';
import { resolveBillingUserId } from '@/lib/plan-modules';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = (session.user as { role?: string }).role;
    const body = await request.json();
    const { planId } = body;

    if (!planId) {
      return NextResponse.json({ error: 'Plan ID is required' }, { status: 400 });
    }

    const me = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, role: true, companyId: true, primaryCompanyId: true },
    });
    if (!me) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const companyId = me.companyId ?? me.primaryCompanyId;
    if (companyId && me.role !== 'ADMIN' && me.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        {
          error:
            'Only a company admin can upgrade the workspace plan. Ask your admin or open Settings → Subscription.',
        },
        { status: 403 }
      );
    }

    // Charge / attach plan on the company billing account when in a workspace
    const billingUserId = await resolveBillingUserId(session.user.id);

    const plan = await prisma.plan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    if (plan.price === 0) {
      return NextResponse.json({ error: 'Free plan does not require payment' }, { status: 400 });
    }

    const location = getRequestLocation(request);
    const localized = localizePlanPrice(plan.price, location.countryCode);
    const chargeAmount = localized.price;

    const order = await razorpay.orders.create({
      amount: chargeAmount,
      currency: plan.currency,
      receipt: `order_${Date.now()}`,
      notes: {
        userId: billingUserId,
        planId: plan.id,
        planName: plan.name,
        paidByUserId: session.user.id,
        countryCode: localized.countryCode,
        pppMultiplier: String(localized.pppMultiplier),
        basePricePaise: String(localized.basePrice),
      },
    });

    await prisma.payment.create({
      data: {
        userId: billingUserId,
        amount: chargeAmount,
        currency: plan.currency,
        status: 'PENDING',
        razorpayOrderId: order.id,
        planId: plan.id,
        description: `Subscription to ${plan.displayName} (${localized.countryCode} @ ${localized.pppMultiplier}x PPP)`,
      },
    });

    const env = process.env.RAZORPAY_ENV || 'test';
    const key =
      env === 'production'
        ? process.env.RAZORPAY_LIVE_KEY_ID || process.env.RAZORPAY_KEY_ID
        : process.env.RAZORPAY_TEST_KEY_ID || process.env.RAZORPAY_KEY_ID;

    if (!key) {
      return NextResponse.json(
        { error: 'Payment gateway is not configured. Set Razorpay API keys in environment.' },
        { status: 503 }
      );
    }

    if (
      !process.env.RAZORPAY_KEY_SECRET &&
      !process.env.RAZORPAY_TEST_KEY_SECRET &&
      !process.env.RAZORPAY_LIVE_KEY_SECRET
    ) {
      return NextResponse.json(
        { error: 'Payment gateway secret is not configured.' },
        { status: 503 }
      );
    }

    return NextResponse.json({
      order,
      key,
      plan: {
        name: plan.displayName,
        price: chargeAmount,
        currency: localized.currency,
        displayCurrency: localized.displayCurrency,
        displayAmount: localized.displayAmount,
        formattedPrice: localized.formattedPrice,
        basePrice: localized.basePrice,
        pppMultiplier: localized.pppMultiplier,
        countryCode: localized.countryCode,
      },
      billingUserId,
      payerRole: role,
    });
  } catch (error: unknown) {
    console.error('Error creating Razorpay order:', error);
    return NextResponse.json(
      {
        error: 'Failed to create order',
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
