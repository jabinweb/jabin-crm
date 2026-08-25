'use client';

import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { useState } from 'react';

interface ProfileCompletionBannerProps {
  isComplete: boolean;
}

export function ProfileCompletionBanner({ isComplete }: ProfileCompletionBannerProps) {
  const router = useRouter();
  const { path } = useWorkspacePaths();
  const [isDismissed, setIsDismissed] = useState(false);

  if (isComplete || isDismissed) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-medium text-foreground">Finish your business profile</p>
        <p className="text-sm text-muted-foreground">
          Add company details so AI outreach and documents use the right context. Takes about two
          minutes.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-8"
          onClick={() => router.push(path('/dashboard/settings'))}
        >
          Complete profile
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setIsDismissed(true)}
          className="h-8 w-8 p-0"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
