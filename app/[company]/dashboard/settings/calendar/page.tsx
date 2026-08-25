'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';

/** Legacy route — calendar sync now lives under Integrations. */
export default function CalendarSettingsRedirectPage() {
  const router = useRouter();
  const { path } = useWorkspacePaths();

  useEffect(() => {
    router.replace(`${path('/dashboard/settings/integrations')}?panel=google_calendar`);
  }, [router, path]);

  return (
    <p className="text-sm text-muted-foreground p-6">Redirecting to Integrations…</p>
  );
}
