'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

const errorMessages: Record<string, string> = {
  Configuration:
    'Sign-in is temporarily unavailable on our side. Please try again in a few minutes.',
  AccessDenied:
    'This account isn’t allowed to sign in. Use the email you were invited with, or ask your workspace admin for access.',
  Verification:
    'This sign-in link has expired or has already been used. Request a new one from the sign-in page.',
  OAuthSignin: 'We couldn’t start Google sign-in. Please try again.',
  OAuthCallback: 'Google sign-in didn’t complete. Please try again.',
  OAuthCreateAccount: 'We couldn’t create your account with Google. Try email and password instead.',
  EmailCreateAccount: 'We couldn’t create your account with that email. Please try again.',
  Callback: 'Sign-in didn’t complete. Please try again.',
  OAuthAccountNotLinked:
    'This Google account could not be linked to your email. Sign in with password or magic link, then try Google again.',
  EmailSignin: 'We couldn’t send the sign-in email. Check the address and try again.',
  CredentialsSignin: 'Sign in failed. Check the details you provided are correct.',
  SessionRequired: 'Please sign in to access this page.',
  Default: 'Something went wrong while signing you in. Please try again.',
};

function ErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error') || 'Default';

  return (
    <AuthShell>
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5 shrink-0" aria-hidden />
            <h2 className="font-[family-name:var(--font-landing-display)] text-2xl font-semibold tracking-tight text-[var(--lp-ink)]">
              Sign-in problem
            </h2>
          </div>
          <p className="text-sm text-[var(--lp-muted)]">
            {errorMessages[error] || errorMessages.Default}
          </p>
        </div>

        <p className="text-xs text-[var(--lp-muted)]">
          If this keeps happening, contact support and mention code{' '}
          <span className="font-mono">{error}</span>.
        </p>

        <div className="flex flex-col gap-2">
          <Button asChild className="h-11 bg-[var(--lp-accent)] hover:bg-[var(--lp-accent-deep)] text-white">
            <Link href="/auth/signin">Try again</Link>
          </Button>
          <Button asChild variant="outline" className="h-11 border-slate-200 bg-white">
            <Link href="/">Back to homepage</Link>
          </Button>
        </div>

        {process.env.NODE_ENV === 'development' && (
          <pre className="whitespace-pre-wrap break-all rounded-lg bg-slate-50 p-3 text-xs text-[var(--lp-muted)] overflow-auto">
            {JSON.stringify({ error, params: Object.fromEntries(searchParams) }, null, 2)}
          </pre>
        )}
      </div>
    </AuthShell>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense
      fallback={
        <AuthShell>
          <div className="flex min-h-[200px] items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--lp-accent)] border-t-transparent" />
          </div>
        </AuthShell>
      }
    >
      <ErrorContent />
    </Suspense>
  );
}
