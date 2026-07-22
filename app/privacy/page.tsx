import Link from 'next/link';
import { getBrandConfig } from '@/lib/branding';

export const metadata = {
  title: 'Privacy',
};

export default function PrivacyPage() {
  const brand = getBrandConfig();

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="mx-auto max-w-2xl px-6 py-16 space-y-6">
        <ButtonBack />
        <h1 className="text-3xl font-semibold tracking-tight">Privacy</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {brand.appName} processes account and workspace data to provide the service (tickets,
          CRM, field tools, billing). Data is scoped to your company workspace. We do not sell
          personal data. Payment details are handled by Razorpay.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          For deletion or access requests, contact{' '}
          <a className="underline" href="mailto:hello@opslane.app">
            hello@opslane.app
          </a>
          . This page is a concise summary and will be expanded as the product grows.
        </p>
      </div>
    </div>
  );
}

function ButtonBack() {
  return (
    <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
      ← Back
    </Link>
  );
}
