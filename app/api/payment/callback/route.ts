import { NextRequest, NextResponse } from 'next/server';
import { completeSubscriptionPayment } from '@/lib/payments/complete-subscription-payment';

async function readCallbackParams(req: NextRequest) {
  const contentType = req.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const body = await req.json();
    return {
      razorpay_order_id: String(body.razorpay_order_id || ''),
      razorpay_payment_id: String(body.razorpay_payment_id || ''),
      razorpay_signature: String(body.razorpay_signature || ''),
    };
  }

  const form = await req.formData();
  return {
    razorpay_order_id: String(form.get('razorpay_order_id') || ''),
    razorpay_payment_id: String(form.get('razorpay_payment_id') || ''),
    razorpay_signature: String(form.get('razorpay_signature') || ''),
  };
}

function redirectTo(origin: string, path: string) {
  return NextResponse.redirect(new URL(path, origin), 303);
}

/** Razorpay POST redirect after successful payment (browser callback). */
export async function POST(req: NextRequest) {
  const origin = req.nextUrl.origin;

  try {
    const params = await readCallbackParams(req);

    if (!params.razorpay_order_id || !params.razorpay_payment_id || !params.razorpay_signature) {
      return redirectTo(origin, '/payment/success?status=missing');
    }

    await completeSubscriptionPayment({
      razorpayOrderId: params.razorpay_order_id,
      razorpayPaymentId: params.razorpay_payment_id,
      razorpaySignature: params.razorpay_signature,
    });

    return redirectTo(origin, '/payment/success?status=ok');
  } catch (error) {
    console.error('Payment callback error:', error);
    const message = error instanceof Error ? error.message : 'verification_failed';
    return redirectTo(
      origin,
      `/payment/success?status=error&reason=${encodeURIComponent(message)}`
    );
  }
}

/** Some flows may land with GET query params — handle as fallback. */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const sp = req.nextUrl.searchParams;
  const orderId = sp.get('razorpay_order_id');
  const paymentId = sp.get('razorpay_payment_id');
  const signature = sp.get('razorpay_signature');

  if (!orderId || !paymentId || !signature) {
    return redirectTo(origin, '/payment/success?status=missing');
  }

  try {
    await completeSubscriptionPayment({
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentId,
      razorpaySignature: signature,
    });
    return redirectTo(origin, '/payment/success?status=ok');
  } catch (error) {
    console.error('Payment callback GET error:', error);
    const message = error instanceof Error ? error.message : 'verification_failed';
    return redirectTo(
      origin,
      `/payment/success?status=error&reason=${encodeURIComponent(message)}`
    );
  }
}
