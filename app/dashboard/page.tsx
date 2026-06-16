'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { StatsCards } from '@/components/dashboard/stats-cards';
import { LeadsChart } from '@/components/dashboard/leads-chart';
import { ProfileCompletionBanner } from '@/components/dashboard/profile-completion-banner';
import { NoCompanyWorkspaceDialog } from '@/components/company/no-company-workspace-dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Play, Pause, Check, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type DashboardStatsResult =
  | { kind: 'stats'; employees: number; clients: number; products: number; projects: number }
  | { kind: 'no_company' }

export default function Dashboard() {
  const [noCompanyDialogOpen, setNoCompanyDialogOpen] = useState(false);

  const { data: statsResult, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async (): Promise<DashboardStatsResult> => {
      const response = await fetch('/api/dashboard/stats');
      const body = (await response.json().catch(() => ({}))) as {
        code?: string;
        error?: string;
        employees?: number;
        clients?: number;
        products?: number;
        projects?: number;
      };
      if (response.status === 403 && body.code === 'NO_COMPANY') {
        return { kind: 'no_company' };
      }
      if (!response.ok) {
        throw new Error(typeof body.error === 'string' ? body.error : 'Failed to fetch stats');
      }
      return {
        kind: 'stats',
        employees: body.employees ?? 0,
        clients: body.clients ?? 0,
        products: body.products ?? 0,
        projects: body.projects ?? 0,
      };
    },
    retry: false,
  });

  useEffect(() => {
    if (statsResult?.kind === 'no_company') {
      setNoCompanyDialogOpen(true);
    }
    if (statsResult?.kind === 'stats') {
      setNoCompanyDialogOpen(false);
    }
  }, [statsResult]);

  const { data: profile } = useQuery({
    queryKey: ['user-profile'],
    queryFn: async () => {
      const response = await fetch('/api/profile');
      if (!response.ok) throw new Error('Failed to fetch profile');
      return response.json();
    },
  });

  const { data: recentTickets } = useQuery({
    queryKey: ['recent-tickets'],
    queryFn: async () => {
      const response = await fetch('/api/tickets?limit=5');
      if (!response.ok) return [];
      return response.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const getPriorityVariant = (priority: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (priority) {
      case 'CRITICAL':
        return 'destructive';
      case 'HIGH':
        return 'default';
      case 'MEDIUM':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <div className="flex-1 space-y-6">
      <NoCompanyWorkspaceDialog open={noCompanyDialogOpen} onOpenChange={setNoCompanyDialogOpen} />

      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between border-b pb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h2>
          <p className="text-muted-foreground text-xs mt-1">Overview of your workspace performance.</p>
        </div>
        <div className="flex items-center gap-2 mt-4 sm:mt-0">
          <Button asChild size="sm" className="px-4">
            <Link href="/dashboard/tickets/new">New Ticket</Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="px-4">
            <Link href="/dashboard/customers/new">Add Client</Link>
          </Button>
        </div>
      </div>

      {/* Profile Completion Banner */}
      {profile && <ProfileCompletionBanner isComplete={profile.isComplete} />}

      {statsResult?.kind === 'stats' ? <StatsCards stats={statsResult as any} /> : null}

      <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-7">
        <LeadsChart />

        <Card className="lg:col-span-3">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Support Tickets</CardTitle>
                <CardDescription>
                  Latest customer issues and service requests
                </CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href="/dashboard/tickets">View All</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!recentTickets || recentTickets.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="mb-4">No tickets recently</p>
                <Button asChild variant="outline">
                  <Link href="/dashboard/tickets/new">
                    Create a Ticket
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {recentTickets?.map((ticket: any) => (
                  <div key={ticket.id} className="flex items-center justify-between space-x-4">
                    <div className="flex items-center space-x-4 min-w-0">
                        <div className={cn(
                          "w-2 h-2 rounded-none",
                          ticket.status === 'OPEN' ? "bg-red-500" :
                            ticket.status === 'IN_PROGRESS' ? "bg-amber-500" : "bg-emerald-500"
                        )} />
                        <div className="truncate">
                          <p className="text-sm font-medium leading-none truncate group-hover:underline">
                            {ticket.subject}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate mt-1">
                            {ticket.customer.organizationName}
                          </p>
                        </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant={getPriorityVariant(ticket.priority)}>
                        {ticket.priority}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

