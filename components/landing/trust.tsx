'use client';

import { Shield, Lock, Building2, CreditCard } from 'lucide-react';
import { getClientBrandConfig } from '@/lib/branding';

const items = [
  {
    icon: Building2,
    title: 'Workspace isolation',
    body: 'Each company is a separate tenant — your data stays in your workspace.',
  },
  {
    icon: Lock,
    title: 'Role-based access',
    body: 'Admins, managers, technicians, and clients only see what they need.',
  },
  {
    icon: Shield,
    title: 'Session security',
    body: 'Signed-in sessions with standard SaaS auth practices.',
  },
  {
    icon: CreditCard,
    title: 'Secure checkout',
    body: 'Paid plans settle via Razorpay. Start free — no card required.',
  },
];

export function TrustSection() {
  const brand = getClientBrandConfig();

  return (
    <section id="trust" className="border-t border-[var(--lp-line)] bg-[var(--lp-bg)]">
      <div className="mx-auto max-w-6xl px-6 py-20 md:py-24">
        <div className="max-w-2xl mb-10">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-[var(--lp-accent)] mb-3">
            Trust
          </p>
          <h2 className="font-[family-name:var(--font-landing-display)] text-3xl md:text-4xl font-semibold tracking-tight text-[var(--lp-ink)]">
            Built for real company data — without overclaiming
          </h2>
          <p className="mt-4 text-[var(--lp-muted)] leading-relaxed">
            {brand.appName} keeps security practical and transparent. We list what we actually
            ship today.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {items.map((item) => (
            <div
              key={item.title}
              className="flex gap-4 rounded-2xl border border-[var(--lp-line)] bg-white p-5"
            >
              <div className="h-9 w-9 rounded-lg bg-teal-50 text-teal-800 flex items-center justify-center shrink-0">
                <item.icon className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[var(--lp-ink)]">{item.title}</h3>
                <p className="mt-1 text-sm text-[var(--lp-muted)] leading-relaxed">{item.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
