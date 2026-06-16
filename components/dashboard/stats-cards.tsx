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
      <Card className="shadow-none">
        <CardHeader className="flex flex-row items-baseline justify-between space-y-0 pb-4">
          <CardTitle className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Customers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-black tracking-tight">
            {stats?.totalCustomers !== undefined ? stats.totalCustomers.toLocaleString() : '0'}
          </div>
          <p className="text-[10px] font-medium text-muted-foreground mt-1 uppercase tracking-tighter">Active Accounts</p>
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader className="flex flex-row items-baseline justify-between space-y-0 pb-4">
          <CardTitle className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Open Tickets</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-black tracking-tight">{stats?.openTickets ?? 0}</div>
          <p className="text-[10px] font-medium text-muted-foreground mt-1 uppercase tracking-tighter">Pending Action</p>
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader className="flex flex-row items-baseline justify-between space-y-0 pb-4">
          <CardTitle className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Equipments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-black tracking-tight">{stats?.equipmentInstalled ?? 0}</div>
          <p className="text-[10px] font-medium text-muted-foreground mt-1 uppercase tracking-tighter">In Field</p>
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader className="flex flex-row items-baseline justify-between space-y-0 pb-4">
          <CardTitle className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Pipeline Leads</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-black tracking-tight">{stats?.totalLeads?.toLocaleString() ?? '0'}</div>
          <div className="flex items-center gap-1 mt-1">
            <span className={cn(
              "text-[10px] font-bold",
              (stats?.weeklyGrowth ?? 0) >= 0 ? "text-emerald-600" : "text-rose-600"
            )}>
              {(stats?.weeklyGrowth ?? 0) >= 0 ? "+" : ""}{stats?.weeklyGrowth ?? 0}%
            </span>
            <span className="text-[10px] uppercase tracking-tighter font-medium text-muted-foreground">Growth</span>
          </div>
        </CardContent>
      </Card>

      {stats?.duplicateLeadsCount !== undefined && stats.duplicateLeadsCount > 0 && (
        <Card className="border-red-500 bg-red-500/[0.03] shadow-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] uppercase tracking-wider font-bold text-red-600">Action Required</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-red-600">
              {stats.duplicateLeadsCount} DUPLICATES
            </div>
            <p className="text-[10px] font-medium text-red-600/70 mb-3 uppercase">
              Found in {stats.duplicateGroupsCount} groups
            </p>
            <Button asChild size="sm" variant="outline" className="text-[10px] h-7 border-red-200 hover:bg-red-100 hover:text-red-700 font-bold uppercase tracking-tighter">
              <Link href="/dashboard/duplicates">
                Resolve Now
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
