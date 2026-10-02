import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { resolveBillingUserId } from '@/lib/plan-modules';

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const subscription = await prisma.subscription.findFirst({
      where: {
        // Workspace plans live on the company billing account (same as /usage, create-order)
        userId: await resolveBillingUserId(session.user.id),
        status: {
          in: ['ACTIVE', 'TRIALING', 'PAST_DUE'],
        },
      },
      include: {
        plan: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ subscription: subscription ?? null });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching subscription:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscription', details: message },
      { status: 500 }
    );
  }
}
