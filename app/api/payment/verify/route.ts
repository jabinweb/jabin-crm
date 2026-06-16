import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { completeSubscriptionPayment } from '@/lib/payments/complete-subscription-payment';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planId } = body;

    await completeSubscriptionPayment({
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
      userId: session.user.id,
      planId,
    });

    return NextResponse.json({
      success: true,
      message: 'Payment verified and subscription activated',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error verifying payment:', error);
    return NextResponse.json(
      { error: 'Failed to verify payment', details: message },
      { status: 400 }
    );
  }
}
