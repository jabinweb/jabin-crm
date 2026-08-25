'use client';

import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import { ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { getClientBrandConfig } from '@/lib/branding';
import { cn } from '@/lib/utils';

const HIGHLIGHTS = [
  'Sales pipeline, projects, and tickets in one place',
  'Industry-ready defaults — no week of training',
  'Client portal and team workspace included',
] as const;

type AuthShellProps = {
  children: ReactNode;
  className?: string;
};

export function AuthShell({ children, className }: AuthShellProps) {
  const brand = getClientBrandConfig();

  return (
    <div
      className={cn(
        'fixed inset-0 flex flex-col overflow-hidden antialiased font-[family-name:var(--font-landing-sans)] text-[var(--lp-ink)]',
        className
      )}
      style={
        {
          '--lp-bg': '#f4f6f8',
          '--lp-ink': '#0f172a',
          '--lp-muted': '#64748b',
          '--lp-accent': '#0d9488',
          '--lp-accent-deep': '#0f766e',
          '--lp-surface': '#ffffff',
          '--lp-line': '#e2e8f0',
          '--lp-night': '#0b1220',
        } as CSSProperties
      }
    >
      <div className="grid min-h-0 flex-1 lg:grid-cols-[1.05fr_1fr]">
        {/* Brand panel */}
        <aside className="relative hidden min-h-0 overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
          <div
            className="pointer-events-none absolute inset-0"
            aria-hidden
            style={{
              background: `
                radial-gradient(ellipse 80% 60% at 70% 20%, rgba(13, 148, 136, 0.22), transparent 55%),
                radial-gradient(ellipse 50% 40% at 10% 80%, rgba(15, 23, 42, 0.08), transparent 50%),
                linear-gradient(165deg, #e8eef2 0%, #f4f6f8 45%, #dfe8e6 100%)
              `,
            }}
          />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.35]"
            aria-hidden
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E")`,
            }}
          />

          <div className="relative">
            <Link
              href="/"
              className="font-[family-name:var(--font-landing-display)] text-xl font-semibold tracking-tight text-[var(--lp-ink)] hover:opacity-80 transition-opacity"
            >
              {brand.appName}
            </Link>
          </div>

          <div className="relative max-w-md space-y-8">
            <div className="space-y-4">
              <h1 className="font-[family-name:var(--font-landing-display)] text-3xl xl:text-4xl font-semibold tracking-tight leading-tight text-[var(--lp-ink)]">
                Welcome back to your workspace
              </h1>
              <p className="text-base leading-relaxed text-[var(--lp-muted)]">
                Sign in to manage deals, delivery, support, and billing — everything your team
                needs in one place.
              </p>
            </div>

            <ul className="space-y-3">
              {HIGHLIGHTS.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-[var(--lp-muted)]">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--lp-accent)]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="relative">
            <Link
              href="/start"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--lp-accent-deep)] hover:text-[var(--lp-accent)] transition-colors"
            >
              New here? Start a free workspace
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </aside>

        {/* Form panel */}
        <main className="flex min-h-0 flex-col justify-center overflow-y-auto bg-[var(--lp-surface)] px-6 py-10 sm:px-10 lg:px-14 xl:px-20">
          <div className="mb-8 flex items-center justify-between lg:hidden">
            <Link
              href="/"
              className="font-[family-name:var(--font-landing-display)] text-lg font-semibold tracking-tight text-[var(--lp-ink)]"
            >
              {brand.appName}
            </Link>
            <Link
              href="/start"
              className="text-sm font-medium text-[var(--lp-accent-deep)] hover:text-[var(--lp-accent)]"
            >
              Start free
            </Link>
          </div>

          <div className="mx-auto w-full max-w-[420px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
