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
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Reset failed');
      router.push('/auth/signin?reset=1');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  if (!token || !email) {
    return (
      <AuthShell>
        <div className="space-y-4 text-center">
          <p className="text-sm text-[var(--lp-muted)]">This reset link is invalid.</p>
          <Button asChild>
            <Link href="/auth/forgot-password">Request a new link</Link>
          </Button>
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
                className="pl-10 pr-10 h-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
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
              className="h-11"
            />
          </div>
          <Button type="submit" className="w-full h-11 bg-[var(--lp-accent)]" disabled={loading}>
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
