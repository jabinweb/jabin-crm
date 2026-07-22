'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowUpRight } from 'lucide-react';
import { getClientBrandConfig } from '@/lib/branding';

export function FinalCta() {
  const brand = getClientBrandConfig();

  return (
    <section className="relative overflow-hidden border-t border-[var(--lp-line)]">
      <div
        className="absolute inset-0"
        aria-hidden
        style={{
          background: `
            radial-gradient(ellipse 70% 80% at 50% 100%, rgba(13, 148, 136, 0.22), transparent 60%),
            linear-gradient(180deg, #f4f6f8 0%, #e2ebe9 100%)
          `,
        }}
      />
      <div className="relative mx-auto max-w-3xl px-6 py-20 md:py-28 text-center">
        <h2 className="font-[family-name:var(--font-landing-display)] text-3xl md:text-4xl font-semibold tracking-tight text-[var(--lp-ink)]">
          Built to be used — not just implemented
        </h2>
        <p className="mt-4 text-[var(--lp-muted)] leading-relaxed max-w-xl mx-auto">
          Spin up {brand.appName} today. Admins get a short setup; everyone else lands on a Home
          screen that shows what needs attention — tickets, SLAs, renewals.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button
            asChild
            className="h-11 px-6 bg-[var(--lp-accent)] hover:bg-[var(--lp-accent-deep)] text-white"
          >
            <Link href="/start">
              Start free trial
              <ArrowUpRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="h-11 px-6 border-slate-300 bg-white/80 text-[var(--lp-ink)]"
          >
            <Link href="/pricing">View pricing</Link>
          </Button>
        </div>
        <p className="mt-4 text-xs text-[var(--lp-muted)]">
          Self-serve workspace · Cancel anytime · HR tools included
        </p>
      </div>
    </section>
  );
}
