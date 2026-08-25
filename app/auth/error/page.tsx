'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

const errorMessages: Record<string, string> = {
  Configuration: 'There is a problem with the server configuration.',
  AccessDenied: 'You do not have permission to sign in.',
  Verification: 'The verification token has expired or has already been used.',
  OAuthSignin: 'Error in constructing an authorization URL.',
  OAuthCallback: 'Error in handling the response from the OAuth provider.',
  OAuthCreateAccount: 'Could not create OAuth provider user in the database.',
  EmailCreateAccount: 'Could not create email provider user in the database.',
  Callback: 'Error in the OAuth callback handler route.',
  OAuthAccountNotLinked:
    'This Google account could not be linked to your email. Sign in with password or magic link, then try Google again.',
  EmailSignin: 'Check your email address.',
  CredentialsSignin: 'Sign in failed. Check the details you provided are correct.',
  SessionRequired: 'Please sign in to access this page.',
  Default: 'An error occurred during authentication.',
};

function ErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error') || 'Default';

  return (
    <AuthShell>
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="size-5" />
            <h2 className="font-[family-name:var(--font-landing-display)] text-2xl font-semibold tracking-tight text-[var(--lp-ink)]">
              Sign-in problem
            </h2>
          </div>
          <p className="text-sm text-[var(--lp-muted)]">
            {errorMessages[error] || errorMessages.Default}
          </p>
        </div>

        <Alert variant="destructive" className="rounded-lg">
          <AlertDescription>
            Error code: <span className="font-mono">{error}</span>
          </AlertDescription>
        </Alert>

        <div className="flex flex-col gap-2">
          <Button asChild className="h-11 bg-[var(--lp-accent)] hover:bg-[var(--lp-accent-deep)] text-white">
            <Link href="/auth/signin">Try again</Link>
          </Button>
          <Button asChild variant="outline" className="h-11 border-slate-200 bg-white">
            <Link href="/">Back to homepage</Link>
          </Button>
        </div>

        {process.env.NODE_ENV === 'development' && (
          <pre className="rounded-lg bg-slate-50 p-3 text-xs text-[var(--lp-muted)] overflow-auto">
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
            <div className="size-6 animate-spin rounded-full border-2 border-[var(--lp-accent)] border-t-transparent" />
          </div>
        </AuthShell>
      }
    >
      <ErrorContent />
    </Suspense>
  );
}
