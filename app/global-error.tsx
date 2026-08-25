'use client';

import { ErrorPageClient } from '@/components/layout/error-page-client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <ErrorPageClient
          error={error}
          reset={reset}
          title="Application error"
          description="A critical error occurred. Try again or return to your workspace."
        />
      </body>
    </html>
  );
}
