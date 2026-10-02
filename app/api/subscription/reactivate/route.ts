import { NextRequest, NextResponse } from 'next/server';
import { resolveBillingUserId } from '@/lib/plan-modules';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

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

    // Find subscription marked for cancellation
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId: billingUserId,
        cancelAtPeriodEnd: true,
        status: {
          in: ['ACTIVE', 'TRIALING'],
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!subscription) {
      return NextResponse.json({ error: 'No subscription found to reactivate' }, { status: 404 });
    }

    // Reactivate subscription
    const updatedSubscription = await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        cancelAtPeriodEnd: false,
      },
    });

    return NextResponse.json({
      message: 'Subscription reactivated successfully',
      subscription: updatedSubscription,
    });
  } catch (error) {
    console.error('Error reactivating subscription:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
