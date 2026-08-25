'use client';

import { ErrorPageClient } from '@/components/layout/error-page-client';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorPageClient
      error={error}
      reset={reset}
      title="Admin error"
      description="An error occurred in the platform admin area."
      primaryHref="/admin"
      primaryLabel="Admin home"
    />
  );
}
