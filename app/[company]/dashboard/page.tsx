'use client';

import Link from 'next/link';
import { StatsCards } from '@/components/dashboard/stats-cards';
import { LeadsChart } from '@/components/dashboard/leads-chart';
import { ProfileCompletionBanner } from '@/components/dashboard/profile-completion-banner';
import {
  GettingStartedChecklist,
  WorkspaceSetupPendingBanner,
} from '@/components/dashboard/getting-started-checklist';
import { EmptyState } from '@/components/ui/empty-state';
import { TicketSlaTimer } from '@/components/tickets/ticket-sla-timer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useQuery } from '@tanstack/react-query';
import {
  Plus,
  Users,
  Ticket,
  Package,
  AlertTriangle,
  Clock,
  FileText,
  ChevronDown,
  UserPlus,
} from 'lucide-react';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { renewalUrgency } from '@/lib/crm/service-contract-utils';
import { DailyEntryBanner } from '@/components/dashboard/daily-entry-banner';
import { AttendanceTodayCard } from '@/components/dashboard/attendance-today-card';

export default function WorkspaceDashboardPage() {
  const { slug, path, workspaceFetch } = useWorkspacePaths();

  const { data: opsToday, isLoading: opsLoading } = useQuery({
    queryKey: ['ops-today', slug],
    queryFn: async () => {
      const response = await workspaceFetch('/api/dashboard/ops-today');
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!slug,
    refetchInterval: 60_000,
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats', slug],
    queryFn: async () => {
      const response = await workspaceFetch('/api/dashboard/stats');
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json();
    },
    enabled: !!slug,
  });

  const { data: profile } = useQuery({
    queryKey: ['user-profile'],
    queryFn: async () => {
      const response = await fetch('/api/profile');
      if (!response.ok) throw new Error('Failed to fetch profile');
      return response.json();
    },
  });

  const { data: recentTickets, isLoading: ticketsLoading } = useQuery({
    queryKey: ['recent-tickets', slug],
    queryFn: async () => {
      const response = await workspaceFetch('/api/tickets?limit=6');
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!slug,
  });

  const { data: supportStats, isLoading: supportLoading } = useQuery({
    queryKey: ['support-stats', slug],
    queryFn: async () => {
      const response = await workspaceFetch('/api/dashboard/support-stats?days=30');
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!slug,
  });

  const { data: renewalsData } = useQuery({
    queryKey: ['contract-renewals', slug],
    queryFn: async () => {
      const response = await workspaceFetch('/api/contracts?renewals=1&withinDays=60');
      if (!response.ok) return { renewals: [], count: 0 };
      return response.json() as Promise<{
        renewals: Array<{
          id: string;
          type: string;
          title: string;
          endDate: string;
          daysLeft: number;
          urgency: string;
          customer?: { organizationName?: string };
        }>;
        count: number;
      }>;
    },
    enabled: !!slug,
  });

  const getPriorityVariant = (
    priority: string
  ): 'default' | 'secondary' | 'destructive' | 'outline' => {
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
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs text-muted-foreground mb-1">
            <Link href={path('/dashboard')} className="hover:text-foreground">
              Home
            </Link>
            <span className="mx-1.5">/</span>
            <span className="text-foreground">Dashboard</span>
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            People, sales, and service — what needs attention today.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild size="sm">
            <Link href={path('/dashboard/tickets/new')}>
              <Ticket className="h-4 w-4" />
              New ticket
            </Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Create
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem asChild>
                <Link href={path('/dashboard/leads/new')}>
                  <Plus className="h-4 w-4 mr-2" />
                  New lead
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={path('/dashboard/customers/new')}>
                  <Users className="h-4 w-4 mr-2" />
                  Add client
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={path('/dashboard/inventory/new')}>
                  <Package className="h-4 w-4 mr-2" />
                  Install equipment
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={path('/dashboard/employees/new')}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite teammate
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <DailyEntryBanner
        loading={opsLoading}
        missing={!!opsToday && !opsToday.dailyEntry?.hasSalesActivityToday}
      />

      {profile && <ProfileCompletionBanner isComplete={profile.isComplete} />}
      <WorkspaceSetupPendingBanner />
      <GettingStartedChecklist />

      <AttendanceTodayCard
        loading={opsLoading}
        name={opsToday?.me?.name}
        attendance={opsToday?.attendance}
      />

      {/* Attention strip: SLA + open work */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {supportLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-8 w-16 mt-2" />
              </CardHeader>
            </Card>
          ))
        ) : (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5">
                  <Ticket className="h-3.5 w-3.5" />
                  Open tickets
                </CardDescription>
                <CardTitle className="text-3xl font-semibold tabular-nums">
                  {supportStats?.summary?.openTickets ?? stats?.openTickets ?? 0}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button asChild variant="link" className="h-auto p-0 text-xs">
                  <Link href={path('/dashboard/tickets')}>View queue</Link>
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  SLA on track
                </CardDescription>
                <CardTitle className="text-3xl font-semibold tabular-nums">
                  {supportStats?.sla?.complianceRate != null
                    ? `${supportStats.sla.complianceRate}%`
                    : '—'}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-amber-200/80">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5 text-amber-700">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  At risk
                </CardDescription>
                <CardTitle className="text-3xl font-semibold tabular-nums text-amber-700">
                  {supportStats?.sla?.atRisk ?? 0}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-destructive/25">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5 text-destructive">
                  Breached
                </CardDescription>
                <CardTitle className="text-3xl font-semibold tabular-nums text-destructive">
                  {supportStats?.sla?.breached ?? 0}
                </CardTitle>
              </CardHeader>
            </Card>
          </>
        )}
      </div>

      {statsLoading ? (
        <div className="grid gap-3 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-3 w-20" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-7 w-14" />
                <Skeleton className="h-3 w-24 mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        stats && <StatsCards stats={stats} omitOpenTickets />
      )}

      {(renewalsData?.count ?? 0) > 0 && (
        <Card className="border-amber-200/80">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-amber-700" />
                Contract renewals
              </CardTitle>
              <CardDescription>
                AMC / CMC ending within 60 days or already overdue
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href={path('/dashboard/contracts')}>All contracts</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {renewalsData!.renewals.slice(0, 6).map((c) => {
                const urgency = c.urgency || renewalUrgency(c.daysLeft);
                return (
                  <Link
                    key={c.id}
                    href={path('/dashboard/contracts')}
                    className="flex items-center justify-between gap-3 rounded-md border p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {c.title}
                        <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                          {c.type}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {c.customer?.organizationName ?? 'Client'} · ends{' '}
                        {new Date(c.endDate).toLocaleDateString(undefined, {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                    <Badge
                      variant={
                        urgency === 'overdue' || urgency === 'critical'
                          ? 'destructive'
                          : urgency === 'soon'
                            ? 'default'
                            : 'secondary'
                      }
                      className="shrink-0"
                    >
                      {c.daysLeft < 0
                        ? `${Math.abs(c.daysLeft)}d overdue`
                        : c.daysLeft === 0
                          ? 'Today'
                          : `${c.daysLeft}d left`}
                    </Badge>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <LeadsChart />

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Recent tickets</CardTitle>
              <CardDescription>Latest service requests in this workspace</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href={path('/dashboard/tickets')}>View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {ticketsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-md" />
                ))}
              </div>
            ) : !recentTickets?.length ? (
              <EmptyState
                icon={Ticket}
                title="No tickets yet"
                description="Create a service ticket when a client reports an issue."
                actionLabel="Create ticket"
                actionHref={path('/dashboard/tickets/new')}
                className="py-8"
              />
            ) : (
              <div className="space-y-2">
                {recentTickets.map(
                  (ticket: {
                    id: string;
                    subject: string;
                    priority: string;
                    status: string;
                    responseDueAt?: string | null;
                    resolutionDueAt?: string | null;
                    firstResponseAt?: string | null;
                    customer?: { organizationName?: string };
                  }) => (
                    <Link
                      key={ticket.id}
                      href={path(`/dashboard/tickets/${ticket.id}`)}
                      className="flex items-center justify-between gap-3 rounded-md border p-3 hover:bg-muted/50 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{ticket.subject}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {ticket.customer?.organizationName ?? 'Client'} ·{' '}
                          {ticket.status.replaceAll('_', ' ')}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <Badge variant={getPriorityVariant(ticket.priority)}>
                          {ticket.priority}
                        </Badge>
                        <TicketSlaTimer ticket={ticket} />
                      </div>
                    </Link>
                  )
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
