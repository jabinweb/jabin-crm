'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { resolvePostLoginPath } from '@/lib/auth/post-login-path';

const REDIRECT_SECONDS = 5;

export default function PaymentSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const status = searchParams.get('status');
  const reason = searchParams.get('reason');
  const [countdown, setCountdown] = useState(REDIRECT_SECONDS);

  const dashboardHref = session?.user
    ? resolvePostLoginPath({
        role: session.user.role,
        companySlug: (session.user as { companySlug?: string }).companySlug,
      })
    : '/workspace';

  const isOk = status === 'ok';
  // Server passes the thrown error message; machine codes like "verification_failed" aren't user copy
  const readableReason =
    reason && !/^[a-z0-9_]+$/i.test(reason) ? reason.replace(/\.?$/, '.') : null;

  useEffect(() => {
    if (!isOk) return;

    const tickTimer = window.setInterval(() => {
      setCountdown((c) => Math.max(0, c - 1));
    }, 1000);

    const redirectTimer = window.setTimeout(() => {
      router.replace(dashboardHref);
    }, REDIRECT_SECONDS * 1000);

    return () => {
      window.clearInterval(tickTimer);
      window.clearTimeout(redirectTimer);
    };
  }, [isOk, router, dashboardHref]);

  return (
    <div className="min-h-[100dvh] flex items-center justify-center px-5 py-10 bg-background">
      <div className="max-w-md w-full text-center space-y-6">
        {status === 'ok' && (
          <>
            <CheckCircle2 className="h-14 w-14 text-green-600 mx-auto" />
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Payment successful</h1>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                Your subscription is active. Redirecting to dashboard in {countdown}s…
              </p>
            </div>
            <Button asChild className="w-full">
              <Link href={dashboardHref}>Go to dashboard</Link>
            </Button>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="h-14 w-14 text-destructive mx-auto" aria-hidden />
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Payment verification failed</h1>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                {readableReason ??
                  'We couldn’t verify this payment.'}{' '}
                If you were charged, don&apos;t pay again — contact{' '}
                <a className="underline underline-offset-2" href="mailto:hello@opslane.app">
                  hello@opslane.app
                </a>{' '}
                and we&apos;ll sort it out.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Button asChild>
                <Link href="/pricing">Back to pricing</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={dashboardHref}>Go to dashboard</Link>
              </Button>
            </div>
          </>
        )}

        {(status === 'missing' || !status) && (
          <>
            <XCircle className="h-14 w-14 text-muted-foreground mx-auto" aria-hidden />
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">We couldn&apos;t confirm your payment</h1>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                The payment provider didn&apos;t send back the details we need. If you completed
                the payment, it can take a few minutes to show up under Billing. If you were
                charged and your plan doesn&apos;t update, contact{' '}
                <a className="underline underline-offset-2" href="mailto:hello@opslane.app">
                  hello@opslane.app
                </a>
                .
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Button asChild>
                <Link href={dashboardHref}>Go to dashboard</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/pricing">Back to pricing</Link>
              </Button>
            </div>
          </>
        )}      </div>
    </div>
  );
}
