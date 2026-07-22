import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { ensureFreeTrialSubscription } from '@/lib/subscription/ensure-free-trial';

export async function POST() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const existingSubscription = await prisma.subscription.findUnique({
      where: { userId: session.user.id },
    });

    if (existingSubscription) {
      return NextResponse.json(
        { error: 'You already have an active subscription' },
        { status: 400 }
      );
    }

    const subscription = await ensureFreeTrialSubscription(session.user.id);

    return NextResponse.json({
      success: true,
      subscription,
      message: 'Free trial activated successfully',
    });
  } catch (error: unknown) {
    console.error('Error activating free plan:', error);
    return NextResponse.json(
      {
        error: 'Failed to activate free plan',
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
