'use client';

import { useState, Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { startGoogleSignIn } from '@/lib/auth/google-sign-in-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Mail, CheckCircle } from 'lucide-react';

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
  const searchParams = useSearchParams();
  const rawCallback = searchParams.get('callbackUrl') || '/workspace';
  const callbackUrl = rawCallback.startsWith('/monitoring') ? '/workspace' : rawCallback;
  const authError = searchParams.get('error');
  const authErrorMessage = authError ? AUTH_ERROR_MESSAGES[authError] ?? 'Sign-in failed. Please try again.' : '';

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
        setError('Failed to send magic link');
      } else {
        setEmailSent(true);
      }
    } catch {
      setError('An error occurred');
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
      setError('An error occurred');
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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md border-foreground/10 shadow-none">
          <CardHeader>
            <div className="flex justify-center mb-6">
              <div className="border border-foreground/20 p-4">
                <CheckCircle className="h-8 w-8 text-foreground" />
              </div>
            </div>
            <CardTitle className="text-center font-black uppercase tracking-widest text-sm">Magic link sent</CardTitle>
            <CardDescription className="text-center">
              We sent a magic link to <strong>{email}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center">
              Click the link in the email to sign in. The link will expire in 24 hours.
            </p>
          </CardContent>
          <CardFooter>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setEmailSent(false);
                setEmail('');
              }}
            >
              Try another email
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-foreground/10 shadow-none">
        <CardHeader>
          <CardTitle className="font-black uppercase tracking-[0.2em] text-sm">Sign in</CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Use Google, password, or a magic link
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {authErrorMessage ? (
            <Alert variant="destructive">
              <AlertDescription>{authErrorMessage}</AlertDescription>
            </Alert>
          ) : null}
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleGoogleSignIn}
            disabled={loading}
          >
            Continue with Google
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or use email</span>
            </div>
          </div>

          <form onSubmit={handlePasswordSignIn} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading || !password}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign in with password'
              )}
            </Button>
          </form>

          <form onSubmit={handleEmailSignIn} className="space-y-3">
            <Button type="submit" variant="secondary" className="w-full" disabled={loading || !email}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Send magic link instead
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SignIn() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin opacity-20" />
      </div>
    }>
      <SignInForm />
    </Suspense>
  );
}
