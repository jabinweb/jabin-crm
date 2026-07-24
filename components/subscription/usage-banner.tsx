'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { cn } from '@/lib/utils';

type UsageRow = {
  key: string;
  label: string;
  used: number;
  limit: number;
  pct: number;
};

function pct(used: number, limit: number) {
  if (limit === -1 || limit <= 0) return 0;
  return Math.min((used / limit) * 100, 100);
}

export function UsageBanner() {
  const { path } = useWorkspacePaths();
  const upgradeHref = path('/dashboard/settings/subscription') || '/pricing';

  const { data: usage } = useQuery({
    queryKey: ['usage-limits'],
    queryFn: async () => {
      const response = await fetch('/api/subscription/usage');
      if (!response.ok) return null;
      return response.json();
    },
    refetchInterval: 30_000,
  });

  if (!usage) return null;

  const rows: UsageRow[] = [
    {
      key: 'leads',
      label: 'Leads',
      used: usage.leadsUsed ?? 0,
      limit: usage.leadsLimit ?? 0,
      pct: pct(usage.leadsUsed ?? 0, usage.leadsLimit ?? 0),
    },
    {
      key: 'emails',
      label: 'Emails',
      used: usage.emailsUsed ?? 0,
      limit: usage.emailsLimit ?? 0,
      pct: pct(usage.emailsUsed ?? 0, usage.emailsLimit ?? 0),
    },
    {
      key: 'campaigns',
      label: 'Campaigns',
      used: usage.campaignsUsed ?? 0,
      limit: usage.campaignsLimit ?? 0,
      pct: pct(usage.campaignsUsed ?? 0, usage.campaignsLimit ?? 0),
    },
  ].filter((r) => r.limit !== -1 && r.limit > 0);

  const over = rows.filter((r) => r.pct >= 100);
  const near = rows.filter((r) => r.pct >= 80 && r.pct < 100);
  if (!over.length && !near.length) return null;

  const hard = over.length > 0;
  const visible = hard ? over : near;

  return (
    <Card
      className={cn(
        'mb-6',
        hard
          ? 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950'
          : 'border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950'
      )}
    >
      <CardContent className="pt-6">
        <div className="flex items-start gap-4">
          <AlertTriangle
            className={cn(
              'mt-0.5 h-5 w-5 shrink-0',
              hard
                ? 'text-red-600 dark:text-red-400'
                : 'text-orange-600 dark:text-orange-400'
            )}
          />
          <div className="flex-1">
            <h3
              className={cn(
                'mb-2 font-semibold',
                hard
                  ? 'text-red-900 dark:text-red-100'
                  : 'text-orange-900 dark:text-orange-100'
              )}
            >
              {hard
                ? 'You have reached your plan limits'
                : "You're approaching your plan limits"}
            </h3>
            <p
              className={cn(
                'mb-3 text-sm',
                hard
                  ? 'text-red-800 dark:text-red-200'
                  : 'text-orange-800 dark:text-orange-200'
              )}
            >
              {hard
                ? 'New leads, emails, or campaigns may be blocked until you upgrade or the monthly allowance resets.'
                : 'Upgrade before you hit the ceiling so your team is not blocked mid-work.'}
            </p>

            <div className="mb-4 space-y-3">
              {visible.map((r) => (
                <div key={r.key}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span
                      className={
                        hard
                          ? 'text-red-800 dark:text-red-200'
                          : 'text-orange-800 dark:text-orange-200'
                      }
                    >
                      {r.label}
                    </span>
                    <span
                      className={cn(
                        'font-medium',
                        hard
                          ? 'text-red-800 dark:text-red-200'
                          : 'text-orange-800 dark:text-orange-200'
                      )}
                    >
                      {r.used} / {r.limit} used
                    </span>
                  </div>
                  <Progress
                    value={r.pct}
                    className={cn(
                      'h-2',
                      hard
                        ? 'bg-red-200 dark:bg-red-900'
                        : 'bg-orange-200 dark:bg-orange-900'
                    )}
                  />
                </div>
              ))}
            </div>

            <Button
              asChild
              size="sm"
              className={
                hard
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-orange-600 hover:bg-orange-700'
              }
            >
              <Link href={upgradeHref}>
                <Sparkles className="mr-2 h-4 w-4" />
                Upgrade plan
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
