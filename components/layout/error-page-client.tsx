'use client';

import { useEffect } from 'react';
import { StatusPage } from '@/components/layout/status-page';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
  description?: string;
  primaryHref?: string;
  primaryLabel?: string;
};

export function ErrorPageClient({
  error,
  reset,
  title = 'Something went wrong',
  description = 'An unexpected error occurred. You can try again or return to a safe page.',
  primaryHref = '/workspace',
  primaryLabel = 'Open workspace',
}: ErrorPageProps) {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.error(error);
    }

    fetch('/api/monitoring/errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: error.message,
        digest: error.digest,
        pathname: typeof window !== 'undefined' ? window.location.pathname : undefined,
        source: 'error-boundary',
      }),
    }).catch(() => undefined);
  }, [error]);

  return (
    <StatusPage
      code="500"
      title={title}
      description={description}
      secondaryAction={{ label: 'Homepage', href: '/' }}
    >
      <div className="rounded-lg border border-[var(--lp-line)] bg-white/90 p-4 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            type="button"
            onClick={reset}
            className="h-10 bg-[var(--lp-accent)] hover:bg-[var(--lp-accent-deep)] text-white"
          >
            <RefreshCw className="mr-2 size-4" />
            Try again
          </Button>
          <Button asChild variant="outline" className="h-10 border-slate-200 bg-white">
            <a href={primaryHref}>{primaryLabel}</a>
          </Button>
        </div>

        {process.env.NODE_ENV === 'development' && (
          <details className="text-xs text-[var(--lp-muted)]">
            <summary className="cursor-pointer font-medium text-[var(--lp-ink)]">
              Error details (development)
            </summary>
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-md bg-slate-50 p-3 text-[11px]">
              {error.message}
              {error.digest ? `\n\ndigest: ${error.digest}` : ''}
            </pre>
          </details>
        )}
      </div>
    </StatusPage>
  );
}
