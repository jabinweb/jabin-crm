import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { razorpay } from '@/lib/razorpay';
import { getRequestLocation } from '@/lib/geo/request-location';
import { localizePlanPrice } from '@/lib/pricing/ppp';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { planId } = body;

    if (!planId) {
      return NextResponse.json({ error: 'Plan ID is required' }, { status: 400 });
    }

    // Get plan details
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

    // Create Razorpay order
    const order = await razorpay.orders.create({
      amount: chargeAmount,
      currency: plan.currency,
      receipt: `order_${Date.now()}`,
      notes: {
        userId: session.user.id,
        planId: plan.id,
        planName: plan.name,
        countryCode: localized.countryCode,
        pppMultiplier: String(localized.pppMultiplier),
        basePricePaise: String(localized.basePrice),
      },
    });

    // Save payment record
    await prisma.payment.create({
      data: {
        userId: session.user.id,
        amount: chargeAmount,
        currency: plan.currency,
        status: 'PENDING',
        razorpayOrderId: order.id,
        planId: plan.id,
        description: `Subscription to ${plan.displayName} (${localized.countryCode} @ ${localized.pppMultiplier}x PPP)`,
      },
    });

    // Get Razorpay key (must match lib/razorpay.ts credentials)
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

    if (!process.env.RAZORPAY_KEY_SECRET && !process.env.RAZORPAY_TEST_KEY_SECRET && !process.env.RAZORPAY_LIVE_KEY_SECRET) {
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
    });

  } catch (error: any) {
    console.error('Error creating Razorpay order:', error);
    return NextResponse.json({ 
      error: 'Failed to create order',
      details: error.message 
    }, { status: 500 });
  }
}
