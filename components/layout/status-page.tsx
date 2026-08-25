import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { ArrowLeft, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getClientBrandConfig } from '@/lib/branding';
import { cn } from '@/lib/utils';

export type StatusAction = {
  label: string;
  href?: string;
  variant?: 'default' | 'outline' | 'ghost';
};

type StatusPageProps = {
  code: string;
  title: string;
  description: string;
  primaryAction?: StatusAction;
  secondaryAction?: StatusAction;
  className?: string;
  children?: ReactNode;
};

export function StatusPage({
  code,
  title,
  description,
  primaryAction,
  secondaryAction,
  className,
  children,
}: StatusPageProps) {
  const brand = getClientBrandConfig();

  return (
    <div
      className={cn(
        'fixed inset-0 flex flex-col overflow-y-auto antialiased font-[family-name:var(--font-landing-sans)]',
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
          background: `
            radial-gradient(ellipse 70% 50% at 80% 10%, rgba(13, 148, 136, 0.12), transparent 55%),
            linear-gradient(165deg, #e8eef2 0%, #f4f6f8 50%, #eef2f4 100%)
          `,
          color: 'var(--lp-ink)',
        } as CSSProperties
      }
    >
      <header className="shrink-0 px-6 py-5 sm:px-10">
        <Link
          href="/"
          className="font-[family-name:var(--font-landing-display)] text-lg font-semibold tracking-tight text-[var(--lp-ink)] hover:opacity-80 transition-opacity"
        >
          {brand.appName}
        </Link>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-16 pt-4">
        <div className="w-full max-w-lg text-center">
          <p className="font-[family-name:var(--font-landing-display)] text-6xl sm:text-7xl font-semibold tracking-tight text-[var(--lp-accent)]/90">
            {code}
          </p>
          <h1 className="mt-4 font-[family-name:var(--font-landing-display)] text-2xl sm:text-3xl font-semibold tracking-tight text-[var(--lp-ink)]">
            {title}
          </h1>
          <p className="mt-3 text-base leading-relaxed text-[var(--lp-muted)]">{description}</p>

          {(primaryAction || secondaryAction) && (
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              {primaryAction?.href ? (
                <Button
                  asChild
                  className="h-11 min-w-[160px] bg-[var(--lp-accent)] hover:bg-[var(--lp-accent-deep)] text-white"
                >
                  <Link href={primaryAction.href}>
                    {primaryAction.label}
                  </Link>
                </Button>
              ) : null}
              {secondaryAction?.href ? (
                <Button
                  asChild
                  variant="outline"
                  className="h-11 min-w-[160px] border-slate-200 bg-white/80 hover:bg-white"
                >
                  <Link href={secondaryAction.href}>
                    {secondaryAction.label === 'Homepage' ? (
                      <>
                        <Home className="mr-2 size-4" />
                        {secondaryAction.label}
                      </>
                    ) : (
                      <>
                        <ArrowLeft className="mr-2 size-4" />
                        {secondaryAction.label}
                      </>
                    )}
                  </Link>
                </Button>
              ) : null}
            </div>
          )}

          {children ? <div className="mt-8 text-left">{children}</div> : null}
        </div>
      </main>
    </div>
  );
}
