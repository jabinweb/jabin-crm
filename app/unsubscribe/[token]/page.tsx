'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';

export default function UnsubscribePage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const [linkError, setLinkError] = useState('');
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (!token) return;
    fetch(`/api/unsubscribe/${token}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.email) {
          setEmail(data.email);
          if (data.isUnsubscribed) {
            setSubmitted(true);
          }
        } else {
          setLinkError('This unsubscribe link is invalid or has expired.');
        }
      })
      .catch(() => setLinkError('This unsubscribe link is invalid or has expired.'))
      .finally(() => setChecking(false));
  }, [token]);

  const handleUnsubscribe = async () => {
    setLoading(true);
    setSubmitError('');

    try {
      const res = await fetch(`/api/unsubscribe/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) throw new Error(data.error);

      setSubmitted(true);
    } catch (err: unknown) {
      setSubmitError(
        err instanceof Error && err.message
          ? err.message
          : 'We couldn’t unsubscribe you just now. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Unsubscribe from emails</CardTitle>
            <CardDescription>Checking your link…</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (linkError) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center gap-2 text-destructive">
              <XCircle className="h-6 w-6 shrink-0" aria-hidden />
              <CardTitle>Link not valid</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-muted-foreground">{linkError}</p>
            <p className="text-sm text-muted-foreground">
              Use the unsubscribe link in the most recent email you received, or reply to that
              email and ask to be removed.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center gap-2 text-green-600 dark:text-green-500">
              <CheckCircle2 className="h-6 w-6 shrink-0" aria-hidden />
              <CardTitle>You&apos;re unsubscribed</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground break-words">
              {email} has been removed from our mailing list.
            </p>
            <p className="text-sm text-muted-foreground">
              You will no longer receive these emails. This change is effective immediately.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>Unsubscribe from emails</CardTitle>
          <CardDescription>
            We&apos;re sorry to see you go. You&apos;re about to unsubscribe:
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 bg-muted rounded-md">
            <p className="font-medium break-words">{email}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">
              Tell us why (optional)
            </Label>
            <Textarea
              id="reason"
              placeholder="E.g., Too many emails, not relevant, etc."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>

          {submitError ? (
            <p role="alert" className="text-sm text-destructive">
              {submitError}
            </p>
          ) : null}

          <Button
            onClick={handleUnsubscribe}
            disabled={loading}
            className="w-full"
            variant="destructive"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Unsubscribing…
              </>
            ) : (
              'Unsubscribe'
            )}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            Changed your mind? Simply close this page.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
