'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardLink } from '@/components/navigation/dashboard-link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface StatsCardsProps {
  stats?: {
    totalLeads?: number;
    totalCompanies?: number;
    totalCustomers?: number;
    customers?: number;
    openTickets?: number;
    equipmentInstalled?: number;
    weeklyGrowth?: number;
    duplicateLeadsCount?: number;
    duplicateGroupsCount?: number;
  };
  /** Hide open-tickets card when Home already shows SLA strip */
  omitOpenTickets?: boolean;
}

export function StatsCards({ stats, omitOpenTickets }: StatsCardsProps) {
  const customers = stats?.totalCustomers ?? stats?.customers ?? 0;

  return (
    <div
      className={cn(
        'grid gap-3',
        omitOpenTickets ? 'md:grid-cols-3' : 'md:grid-cols-2 lg:grid-cols-4'
      )}
    >
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Clients</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold tabular-nums">{customers.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground mt-1">Active accounts</p>
        </CardContent>
      </Card>

      {!omitOpenTickets && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Open tickets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">{stats?.openTickets ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Need attention</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Installed equipment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold tabular-nums">
            {stats?.equipmentInstalled ?? 0}
          </div>
          <p className="text-xs text-muted-foreground mt-1">In the field</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Pipeline leads</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold tabular-nums">
            {stats?.totalLeads?.toLocaleString() ?? '0'}
          </div>
          <div className="flex items-center gap-1 mt-1">
            <span
              className={cn(
                'text-xs font-medium',
                (stats?.weeklyGrowth ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'
              )}
            >
              {(stats?.weeklyGrowth ?? 0) >= 0 ? '+' : ''}
              {stats?.weeklyGrowth ?? 0}%
            </span>
            <span className="text-xs text-muted-foreground">this week</span>
          </div>
        </CardContent>
      </Card>

      {stats?.duplicateLeadsCount !== undefined && stats.duplicateLeadsCount > 0 && (
        <Card className="border-red-200 bg-red-50/40 md:col-span-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-700">
              Duplicates need review
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-red-700/80">
              {stats.duplicateLeadsCount} duplicate leads in {stats.duplicateGroupsCount} groups
            </p>
            <Button asChild size="sm" variant="outline">
              <DashboardLink href="/dashboard/duplicates">Review duplicates</DashboardLink>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
