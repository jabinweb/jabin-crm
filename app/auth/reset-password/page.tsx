'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Eye, EyeOff, Loader2, Lock } from 'lucide-react';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const email = searchParams.get('email') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token, password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Reset failed');
      router.push('/auth/signin?reset=1');
    } catch (err) {
      setError(
        err instanceof Error && err.message !== 'Reset failed'
          ? err.message
          : 'We couldn’t update your password. The link may have expired — request a new one.'
      );
    } finally {
      setLoading(false);
    }
  };

  if (!token || !email) {
    return (
      <AuthShell>
        <div className="space-y-6 text-center">
          <div className="space-y-2">
            <h2 className="font-[family-name:var(--font-landing-display)] text-2xl font-semibold tracking-tight text-[var(--lp-ink)]">
              Link not valid
            </h2>
            <p className="text-sm text-[var(--lp-muted)]">
              This password reset link is incomplete or has expired. Request a new one and use the
              latest email we send.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Button asChild className="h-11 bg-[var(--lp-accent)] text-white hover:bg-[var(--lp-accent-deep)]">
              <Link href="/auth/forgot-password">Request a new link</Link>
            </Button>
            <Button asChild variant="outline" className="h-11 border-slate-200 bg-white">
              <Link href="/auth/signin">Back to sign in</Link>
            </Button>
          </div>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div className="space-y-6">
        <Link
          href="/auth/signin"
          className="inline-flex items-center text-sm text-[var(--lp-muted)] hover:text-[var(--lp-ink)]"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to sign in
        </Link>
        <div className="space-y-2">
          <h2 className="font-[family-name:var(--font-landing-display)] text-2xl font-semibold tracking-tight text-[var(--lp-ink)]">
            Choose a new password
          </h2>
          <p className="text-sm text-[var(--lp-muted)]">
            For <span className="break-all font-medium text-[var(--lp-ink)]">{email}</span>. Use at
            least 8 characters.
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                className="pl-10 pr-10 h-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center text-slate-400"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm password</Label>
            <Input
              id="confirm"
              type={showPassword ? 'text' : 'password'}
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              aria-invalid={confirm.length > 0 && confirm !== password}
              className="h-11"
            />
          </div>
          {confirm.length >= password.length && confirm.length > 0 && confirm !== password ? (
            <p className="-mt-2 text-xs text-destructive">Passwords don&apos;t match yet.</p>
          ) : null}
          <Button
            type="submit"
            className="w-full h-11 bg-[var(--lp-accent)] text-white hover:bg-[var(--lp-accent-deep)]"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              'Update password'
            )}
          </Button>
        </form>
      </div>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <AuthShell>
          <div className="flex min-h-[200px] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </AuthShell>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
