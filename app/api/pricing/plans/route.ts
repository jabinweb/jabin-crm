import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getRequestLocation } from '@/lib/geo/request-location';
import { localizePlanPrice } from '@/lib/pricing/ppp';

export async function GET(req: NextRequest) {
  try {
    const location = getRequestLocation(req);

    const plans = await prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { price: 'asc' },
    });

    const localizedPlans = plans.map((plan) => {
      const pricing = localizePlanPrice(plan.price, location.countryCode);
      return {
        ...plan,
        basePrice: pricing.basePrice,
        price: pricing.price,
        currency: pricing.currency,
        displayCurrency: pricing.displayCurrency,
        displayAmount: pricing.displayAmount,
        baseDisplayAmount: pricing.baseDisplayAmount,
        formattedPrice: pricing.formattedPrice,
        formattedBasePrice: pricing.formattedBasePrice,
        pppMultiplier: pricing.pppMultiplier,
        pppTier: pricing.pppTier,
        pppLabel: pricing.pppLabel,
        savingsPercent: pricing.savingsPercent,
      };
    });

    return NextResponse.json({
      plans: localizedPlans,
      location: {
        countryCode: location.countryCode,
        source: location.source,
        currency: localizedPlans[0]?.displayCurrency ?? 'INR',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching plans:', error);
    return NextResponse.json(
      { error: 'Failed to fetch plans', details: message },
      { status: 500 }
    );
  }
}
