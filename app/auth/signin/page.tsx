'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { startGoogleSignIn } from '@/lib/auth/google-sign-in-client';
import { AuthShell } from '@/components/auth/auth-shell';
import { GoogleIcon } from '@/components/auth/google-icon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Mail, Lock, CheckCircle2, ArrowLeft, Eye, EyeOff } from 'lucide-react';

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  OAuthAccountNotLinked:
    'This Google account could not be linked. Try email + password if you registered that way, or contact your admin.',
  AccessDenied:
    'Sign-in was denied. Use a registered email or ask an admin to invite you.',
  CredentialsSignin: 'Invalid email or password.',
  Configuration: 'Authentication is misconfigured. Check server environment variables.',
  OAuthCallback: 'Google sign-in failed. Clear cookies and try again.',
};

function SignInForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const searchParams = useSearchParams();
  const rawCallback = searchParams.get('callbackUrl') || '/workspace';
  const callbackUrl = rawCallback.startsWith('/monitoring') ? '/workspace' : rawCallback;
  const authError = searchParams.get('error');
  const authErrorMessage = authError
    ? (AUTH_ERROR_MESSAGES[authError] ?? 'Sign-in failed. Please try again.')
    : '';

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await signIn('nodemailer', {
        email: email.trim().toLowerCase(),
        redirect: false,
        callbackUrl,
      });

      if (result?.error) {
        setError('Failed to send magic link. Check the email and try again.');
      } else {
        setEmailSent(true);
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await signIn('credentials', {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
        callbackUrl,
      });

      if (result?.error) {
        setError(AUTH_ERROR_MESSAGES.CredentialsSignin);
      } else if (result?.ok) {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    try {
      await startGoogleSignIn(callbackUrl);
    } catch {
      setError('Google sign-in failed. Please try again.');
      setLoading(false);
    }
  };

  if (emailSent) {
    return (
      <AuthShell>
        <div className="space-y-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-teal-50 ring-1 ring-teal-100">
            <CheckCircle2 className="h-7 w-7 text-[var(--lp-accent)]" />
          </div>
          <div className="space-y-2">
            <h2 className="font-[family-name:var(--font-landing-display)] text-2xl font-semibold tracking-tight text-[var(--lp-ink)]">
              Check your inbox
            </h2>
            <p className="text-sm leading-relaxed text-[var(--lp-muted)]">
              We sent a sign-in link to{' '}
              <span className="font-medium text-[var(--lp-ink)]">{email}</span>. Click the link to
              continue — it expires in 24 hours.
            </p>
          </div>
          <Button
            variant="outline"
            className="w-full h-11 border-slate-200 bg-white hover:bg-slate-50"
            onClick={() => {
              setEmailSent(false);
              setEmail('');
            }}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Use a different email
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div className="space-y-8">
        <div className="space-y-2">
          <h2 className="font-[family-name:var(--font-landing-display)] text-2xl sm:text-3xl font-semibold tracking-tight text-[var(--lp-ink)]">
            Sign in
          </h2>
          <p className="text-sm text-[var(--lp-muted)]">
            Continue with Google, or use your email and password.
          </p>
        </div>

        {(authErrorMessage || error) && (
          <Alert variant="destructive" className="rounded-lg">
            <AlertDescription>{authErrorMessage || error}</AlertDescription>
          </Alert>
        )}

        <Button
          type="button"
          variant="outline"
          className="h-11 w-full border-slate-200 bg-white text-[var(--lp-ink)] shadow-sm hover:bg-slate-50"
          onClick={handleGoogleSignIn}
          disabled={loading}
        >
          <GoogleIcon className="mr-2.5 h-5 w-5" />
          Continue with Google
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <Separator className="w-full bg-[var(--lp-line)]" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-[var(--lp-surface)] px-3 text-[var(--lp-muted)]">
              or continue with email
            </span>
          </div>
        </div>

        <Tabs defaultValue="password" className="w-full">
          <TabsList className="grid h-10 w-full grid-cols-2 rounded-lg border border-slate-200 bg-slate-100/80 p-1 text-[var(--lp-muted)]">
            <TabsTrigger
              value="password"
              className="rounded-md text-xs font-semibold uppercase tracking-wide text-[var(--lp-muted)] data-[state=active]:bg-white data-[state=active]:text-[var(--lp-ink)] data-[state=active]:shadow-sm"
            >
              Password
            </TabsTrigger>
            <TabsTrigger
              value="magic"
              className="rounded-md text-xs font-semibold uppercase tracking-wide text-[var(--lp-muted)] data-[state=active]:bg-white data-[state=active]:text-[var(--lp-ink)] data-[state=active]:shadow-sm"
            >
              Magic link
            </TabsTrigger>
          </TabsList>

          <TabsContent value="password" className="mt-6 space-y-4">
            <form onSubmit={handlePasswordSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-[var(--lp-ink)]">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                    className="h-11 border-slate-200 bg-white pl-10 shadow-sm focus-visible:ring-[var(--lp-accent)]"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-[var(--lp-ink)]">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    className="h-11 border-slate-200 bg-white pl-10 pr-10 shadow-sm focus-visible:ring-[var(--lp-accent)]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Link
                  href="/auth/forgot-password"
                  className="text-xs text-[var(--lp-muted)] hover:text-[var(--lp-accent-deep)] hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <Button
                type="submit"
                className="h-11 w-full bg-[var(--lp-accent)] text-white shadow-sm hover:bg-[var(--lp-accent-deep)]"
                disabled={loading || !password}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign in'
                )}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="magic" className="mt-6 space-y-4">
            <form onSubmit={handleEmailSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="magic-email" className="text-sm font-medium text-[var(--lp-ink)]">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="magic-email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                    className="h-11 border-slate-200 bg-white pl-10 shadow-sm focus-visible:ring-[var(--lp-accent)]"
                  />
                </div>
              </div>
              <p className="text-xs leading-relaxed text-[var(--lp-muted)]">
                We&apos;ll email you a secure link — no password needed.
              </p>
              <Button
                type="submit"
                className="h-11 w-full bg-[var(--lp-accent)] text-white shadow-sm hover:bg-[var(--lp-accent-deep)]"
                disabled={loading || !email}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending link...
                  </>
                ) : (
                  'Send magic link'
                )}
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <p className="text-center text-sm text-[var(--lp-muted)]">
          Don&apos;t have a workspace?{' '}
          <Link
            href="/start"
            className="font-medium text-[var(--lp-accent-deep)] hover:text-[var(--lp-accent)] hover:underline underline-offset-4"
          >
            Start free
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}

export default function SignIn() {
  return (
    <Suspense
      fallback={
        <AuthShell>
          <div className="flex min-h-[320px] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--lp-muted)]" />
          </div>
        </AuthShell>
      }
    >
      <SignInForm />
    </Suspense>
  );
}
