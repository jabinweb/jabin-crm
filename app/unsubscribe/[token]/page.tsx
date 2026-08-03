'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CheckCircle2, XCircle } from 'lucide-react';

export default function UnsubscribePage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

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
          setError('Invalid unsubscribe link');
        }
      })
      .catch(() => setError('Invalid unsubscribe link'));
  }, [token]);

  const handleUnsubscribe = async () => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/unsubscribe/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      setSubmitted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to unsubscribe');
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center gap-2 text-destructive">
              <XCircle className="h-6 w-6" />
              <CardTitle>Error</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-6 w-6" />
              <CardTitle>Unsubscribed Successfully</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              {email} has been removed from our mailing list.
            </p>
            <p className="text-sm text-muted-foreground">
              You will no longer receive emails from us. This change is effective immediately.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>Unsubscribe from Emails</CardTitle>
          <CardDescription>
            We&apos;re sorry to see you go. You&apos;re about to unsubscribe:
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 bg-muted rounded-md">
            <p className="font-medium">{email}</p>
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

          <Button
            onClick={handleUnsubscribe}
            disabled={loading}
            className="w-full"
            variant="destructive"
          >
            {loading ? 'Unsubscribing...' : 'Confirm Unsubscribe'}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            Changed your mind? Simply close this page.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
