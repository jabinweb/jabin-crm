'use client';

import { ErrorPageClient } from '@/components/layout/error-page-client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorPageClient error={error} reset={reset} />;
}
