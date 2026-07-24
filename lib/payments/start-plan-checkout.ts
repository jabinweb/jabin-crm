'use client';

import { toast } from 'sonner';
import { loadRazorpayCheckout } from '@/lib/payments/load-razorpay';
import { resolvePostLoginPath } from '@/lib/auth/post-login-path';

type SessionLike = {
  user?: {
    email?: string | null;
    name?: string | null;
    role?: string;
    companySlug?: string;
  } | null;
} | null;

/**
 * Start Razorpay checkout for a paid plan (or activate Free).
 * Used by /pricing and Settings → Subscription so Upgrade does not just bounce to /pricing.
 */
export async function startPlanCheckout(options: {
  planId: string;
  planName: string;
  session: SessionLike;
  onBusy?: (busy: boolean) => void;
  onVerifying?: (verifying: boolean) => void;
  /** Where to go after success (default: post-login path) */
  successPath?: string;
}): Promise<{ ok: boolean }> {
  const { planId, planName, session, onBusy, onVerifying, successPath } = options;

  if (!session?.user) {
    toast.error('Please sign in to select a plan');
    window.location.href = `/auth/signin?callbackUrl=${encodeURIComponent(window.location.pathname)}`;
    return { ok: false };
  }

  const goSuccess = () => {
    const path =
      successPath ||
      resolvePostLoginPath({
        role: session.user?.role,
        companySlug: session.user?.companySlug,
      });
    window.location.href = path;
  };

  if (planName === 'free') {
    onBusy?.(true);
    try {
      const response = await fetch('/api/subscription/activate-free', { method: 'POST' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Failed to activate free plan');
      toast.success('Free plan activated');
      goSuccess();
      return { ok: true };
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to activate plan');
      return { ok: false };
    } finally {
      onBusy?.(false);
    }
  }

  onBusy?.(true);
  try {
    const response = await fetch('/api/payment/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || data.details || 'Failed to create order');
    }

    const { order, key, plan: orderPlan } = data;
    if (!order?.id || !key) {
      throw new Error('Invalid payment session. Check Razorpay configuration.');
    }

    await loadRazorpayCheckout();
    if (!window.Razorpay) {
      throw new Error('Razorpay checkout failed to initialize');
    }

    const callbackUrl = `${window.location.origin}/api/payment/callback`;

    const razorpay = new window.Razorpay({
      key,
      amount: order.amount,
      currency: order.currency,
      name: process.env.NEXT_PUBLIC_APP_NAME || 'Opslane',
      description: `${orderPlan?.formattedPrice ?? ''} / month — ${planName} plan`,
      order_id: order.id,
      callback_url: callbackUrl,
      redirect: true,
      handler: async function (paymentResponse: {
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
      }) {
        try {
          onVerifying?.(true);
          toast.loading('Verifying payment…', { id: 'payment-verify' });
          const verifyResponse = await fetch('/api/payment/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_order_id: paymentResponse.razorpay_order_id,
              razorpay_payment_id: paymentResponse.razorpay_payment_id,
              razorpay_signature: paymentResponse.razorpay_signature,
              planId,
            }),
          });
          if (verifyResponse.ok) {
            toast.success('Payment successful — activating subscription…', {
              id: 'payment-verify',
            });
            setTimeout(goSuccess, 1200);
          } else {
            const errorData = await verifyResponse.json().catch(() => ({}));
            toast.error(errorData.error || 'Payment verification failed', {
              id: 'payment-verify',
            });
            onVerifying?.(false);
          }
        } catch {
          toast.error('Failed to verify payment', { id: 'payment-verify' });
          onVerifying?.(false);
        }
      },
      modal: {
        ondismiss: function () {
          onBusy?.(false);
        },
      },
      prefill: {
        email: session.user.email || '',
        name: session.user.name || '',
        contact: '',
      },
      theme: { color: '#0f766e' },
    });

    razorpay.on('payment.failed', function (response: { error?: { description?: string } }) {
      toast.error(response.error?.description || 'Payment failed');
      onBusy?.(false);
      onVerifying?.(false);
    });

    razorpay.open();
    return { ok: true };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message.includes('timed out') || error.message.includes('network')
          ? 'Could not load Razorpay. Disable ad blockers and try again.'
          : error.message
        : 'Failed to initiate payment';
    toast.error(message);
    return { ok: false };
  } finally {
    onBusy?.(false);
  }
}
