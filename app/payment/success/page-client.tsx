'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
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
    <div className="min-h-screen flex items-center justify-center px-6 bg-background">
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
            <XCircle className="h-14 w-14 text-destructive mx-auto" />
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Payment verification failed</h1>
              <p className="text-muted-foreground mt-2 text-sm">{reason || 'Please contact support.'}</p>
            </div>
            <div className="flex flex-col gap-2">
              <Button asChild variant="outline">
                <Link href="/pricing">Back to pricing</Link>
              </Button>
              <Button asChild>
                <Link href={dashboardHref}>Dashboard</Link>
              </Button>
            </div>
          </>
        )}

        {(status === 'missing' || !status) && (
          <>
            <Loader2 className="h-10 w-10 animate-spin text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">Processing payment status…</p>
            <Button asChild variant="outline">
              <Link href={dashboardHref}>Dashboard</Link>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
