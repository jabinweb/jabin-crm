'use client';

import Link from 'next/link';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';

type Props = {
  missing: boolean;
  loading?: boolean;
};

/** Nudge when the signed-in user has no sales activity logged today. */
export function DailyEntryBanner({ missing, loading }: Props) {
  const { path } = useWorkspacePaths();

  if (loading || !missing) return null;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950">
      <div className="flex items-start gap-3 min-w-0">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-700" />
        <div className="min-w-0">
          <p className="text-sm font-medium">Daily sales entry missing</p>
          <p className="text-xs text-amber-800/80 mt-0.5">
            You haven&apos;t logged a lead or sales activity today yet.
          </p>
        </div>
      </div>
      <Button
        asChild
        size="sm"
        className="shrink-0 bg-amber-700 hover:bg-amber-800 text-white"
      >
        <Link href={path('/dashboard/leads/new')}>
          Record now
          <ArrowRight className="h-3.5 w-3.5 ml-1" />
        </Link>
      </Button>
    </div>
  );
}
