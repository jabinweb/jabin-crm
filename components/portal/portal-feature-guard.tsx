'use client';

import { useWorkspaceConfig } from '@/hooks/use-workspace-config';
import type { WorkspaceFeatureKey } from '@/lib/workspace-templates';
import { FormSkeleton } from '@/components/loading';
import { Lock } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

/** Gate portal pages by company workspace features (industry template). */
export function PortalFeatureGuard({
  feature,
  children,
  title = 'Not available',
  description = 'This area is not enabled for your account.',
  /** When true (default), render nothing while config loads so the page owns the only loader. */
  quietLoading = true,
}: {
  feature: WorkspaceFeatureKey;
  children: React.ReactNode;
  title?: string;
  description?: string;
  quietLoading?: boolean;
}) {
  const { data, isLoading } = useWorkspaceConfig();

  if (isLoading || !data?.config) {
    if (quietLoading) return null;
    return <FormSkeleton fields={4} withHeader />;
  }

  if (data.config.features[feature] !== true) {
    return (
      <div className="mx-auto max-w-md py-16 text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Lock className="h-5 w-5 text-muted-foreground" />
        </div>
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
        <Button asChild variant="outline">
          <Link href="/portal">Back to portal</Link>
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
