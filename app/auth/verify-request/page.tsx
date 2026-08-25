import Link from 'next/link';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Mail } from 'lucide-react';

export default function VerifyRequest() {
  return (
    <AuthShell>
      <div className="space-y-6 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-teal-50 ring-1 ring-teal-100">
          <Mail className="size-7 text-[var(--lp-accent)]" />
        </div>
        <div className="space-y-2">
          <h2 className="font-[family-name:var(--font-landing-display)] text-2xl font-semibold tracking-tight text-[var(--lp-ink)]">
            Check your email
          </h2>
          <p className="text-sm leading-relaxed text-[var(--lp-muted)]">
            We sent a sign-in link to your inbox. Click it to continue — the link expires in 24
            hours.
          </p>
        </div>
        <p className="text-xs text-[var(--lp-muted)]">
          Didn&apos;t request this? You can safely ignore the email.
        </p>
        <Button asChild variant="outline" className="h-11 w-full border-slate-200 bg-white">
          <Link href="/auth/signin">Back to sign in</Link>
        </Button>
      </div>
    </AuthShell>
  );
}
