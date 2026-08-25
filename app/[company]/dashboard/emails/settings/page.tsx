'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';

/** Legacy route — email SMTP/IMAP now lives under Integrations. */
export default function EmailSettingsRedirectPage() {
  const router = useRouter();
  const { path } = useWorkspacePaths();
  const searchParams = useSearchParams();

  useEffect(() => {
    const panel = searchParams.get('panel') || 'email';
    router.replace(`${path('/dashboard/settings/integrations')}?panel=${panel}`);
  }, [router, path, searchParams]);

  return (
    <p className="text-sm text-muted-foreground p-6">Redirecting to Integrations…</p>
  );
}
