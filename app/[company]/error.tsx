'use client';

import { useParams } from 'next/navigation';
import { ErrorPageClient } from '@/components/layout/error-page-client';

export default function CompanyError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams<{ company?: string }>();
  const slug = typeof params?.company === 'string' ? params.company : null;
  const dashboardHref = slug ? `/${slug}/dashboard` : '/workspace';

  return (
    <ErrorPageClient
      error={error}
      reset={reset}
      primaryHref={dashboardHref}
      primaryLabel="Back to dashboard"
    />
  );
}
