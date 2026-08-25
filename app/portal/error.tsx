'use client';

import { ErrorPageClient } from '@/components/layout/error-page-client';

export default function PortalError({
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
      title="Portal error"
      description="Something went wrong in the client portal. Try again or return to your portal home."
      primaryHref="/portal"
      primaryLabel="Portal home"
    />
  );
}
