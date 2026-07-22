import Link from 'next/link';
import { getBrandConfig } from '@/lib/branding';

export const metadata = {
  title: 'Terms',
};

export default function TermsPage() {
  const brand = getBrandConfig();

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="mx-auto max-w-2xl px-6 py-16 space-y-6">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">Terms of use</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          By using {brand.appName} you agree to use the service lawfully, keep credentials secure,
          and respect other tenants&apos; data. Paid plans renew per your selected interval until
          cancelled. Free plans may include usage limits.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          The service is provided as-is while we iterate quickly for service SMBs. Questions:{' '}
          <a className="underline" href="mailto:hello@opslane.app">
            hello@opslane.app
          </a>
          .
        </p>
      </div>
    </div>
  );
}
