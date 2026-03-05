'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Building, AlertTriangle, Activity, Database, Copy } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface StatsCardsProps {
  stats?: {
    totalLeads?: number;
    totalCompanies?: number;
    totalCustomers?: number;
    openTickets?: number;
    equipmentInstalled?: number;
    weeklyGrowth?: number;
    duplicateLeadsCount?: number;
    duplicateGroupsCount?: number;
  };
}

export function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
          <Building className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {stats?.totalCustomers !== undefined ? stats.totalCustomers.toLocaleString() : '0'}
          </div>
          <p className="text-xs text-muted-foreground">Active hospitals & clinics</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Open Tickets</CardTitle>
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats?.openTickets ?? 0}</div>
          <p className="text-xs text-muted-foreground">Awaiting resolution</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Equipment Installed</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats?.equipmentInstalled ?? 0}</div>
          <p className="text-xs text-muted-foreground">Units in field</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats?.totalLeads?.toLocaleString() ?? '0'}</div>
          <div className="flex items-center gap-1 mt-1">
            <span className={cn(
              "text-xs font-medium",
              (stats?.weeklyGrowth ?? 0) >= 0 ? "text-green-600" : "text-red-600"
            )}>
              {(stats?.weeklyGrowth ?? 0) >= 0 ? "+" : ""}{stats?.weeklyGrowth ?? 0}%
            </span>
            <span className="text-xs text-muted-foreground">vs last week</span>
          </div>
        </CardContent>
      </Card>

      {stats?.duplicateLeadsCount !== undefined && stats.duplicateLeadsCount > 0 && (
        <Card className="border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Duplicates Found</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">
              {stats.duplicateLeadsCount}
            </div>
            <p className="text-xs text-orange-600 dark:text-orange-400 mb-2">
              In {stats.duplicateGroupsCount} groups
            </p>
            <Button asChild size="sm" variant="outline" className="text-xs h-7">
              <Link href="/dashboard/duplicates">
                <Copy className="mr-1 h-3 w-3" />
                Review & Merge
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
