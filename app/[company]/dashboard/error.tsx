'use client';

import { useParams } from 'next/navigation';
import { ErrorPageClient } from '@/components/layout/error-page-client';

export default function DashboardError({
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
      title="Dashboard error"
      description="This page hit an error. Your workspace is still available — try again or go back to the dashboard home."
      primaryHref={dashboardHref}
      primaryLabel="Dashboard home"
    />
  );
}
