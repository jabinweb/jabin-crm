import { NextRequest, NextResponse } from 'next/server';
import { resolveBillingUserId } from '@/lib/plan-modules';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { razorpay } from '@/lib/razorpay';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // Billing belongs to the workspace: admins act on the company's billing account,
    // the same one /subscription/current shows.
    if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const billingUserId = await resolveBillingUserId(session.user.id);

    // Find active subscription
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId: billingUserId,
        status: {
          in: ['ACTIVE', 'TRIALING'],
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!subscription) {
      return NextResponse.json({ error: 'No active subscription found' }, { status: 404 });
    }

    // If it's a paid subscription with Razorpay, cancel it there too
    if (subscription.razorpaySubscriptionId) {
      try {
        await razorpay.subscriptions.cancel(subscription.razorpaySubscriptionId, true);
      } catch (error) {
        console.error('Error cancelling Razorpay subscription:', error);
        // Continue with local cancellation even if Razorpay fails
      }
    }

    // Mark subscription for cancellation at period end
    const updatedSubscription = await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        cancelAtPeriodEnd: true,
      },
    });

    return NextResponse.json({
      message: 'Subscription will be cancelled at the end of billing period',
      subscription: updatedSubscription,
    });
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
