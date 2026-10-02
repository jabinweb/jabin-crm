import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { resolveBillingUserId } from '@/lib/plan-modules';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payments = await prisma.payment.findMany({
      where: {
        // create-order records payments against the company billing account
        userId:
          session.user.role === 'ADMIN' || session.user.role === 'SUPER_ADMIN'
            ? await resolveBillingUserId(session.user.id)
            : session.user.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 20, // Last 20 payments
    });

    return NextResponse.json(payments);
  } catch (error) {
    console.error('Error fetching payment history:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
