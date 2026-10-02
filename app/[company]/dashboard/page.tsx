'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { StatsCards } from '@/components/dashboard/stats-cards';
import { ProfileCompletionBanner } from '@/components/dashboard/profile-completion-banner';
import {
  GettingStartedChecklist,
  WorkspaceSetupPendingBanner,
  useGettingStartedActive,
} from '@/components/dashboard/getting-started-checklist';
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
import { format } from 'date-fns';
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
  TrendingDown,
  FolderKanban,
} from 'lucide-react';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { useWorkspaceConfig } from '@/hooks/use-workspace-config';
import { renewalUrgency } from '@/lib/crm/service-contract-utils';
import { DailyEntryBanner } from '@/components/dashboard/daily-entry-banner';
import { AttendanceTodayCard } from '@/components/dashboard/attendance-today-card';
import { useSession } from 'next-auth/react';
import { useFeatureModule } from '@/components/feature-module-guard';
import { STATUS_LABELS as TICKET_STATUS_LABELS } from '@/lib/support/status-pipelines';
import { humanizeEnum } from '@/lib/format/humanize';
const LeadsChart = dynamic(
  () => import('@/components/dashboard/leads-chart').then((mod) => mod.LeadsChart),
  { ssr: false, loading: () => <Skeleton className="h-80 w-full" /> }
);
const AgentQueueCard = dynamic(
  () => import('@/components/dashboard/agent-queue-card').then((mod) => mod.AgentQueueCard),
  { ssr: false, loading: () => <Skeleton className="h-40 w-full" /> }
);
const ModuleHubCards = dynamic(
  () => import('@/components/dashboard/module-hub-cards').then((mod) => mod.ModuleHubCards),
  { ssr: false, loading: () => <Skeleton className="h-48 w-full" /> }
);

export default function WorkspaceDashboardPage() {
  const { slug, path, workspaceFetch } = useWorkspacePaths();
  const { data: workspaceData } = useWorkspaceConfig();
  const features = workspaceData?.config.features;
  const terminology = workspaceData?.config.terminology;
  const vertical = workspaceData?.config.businessVertical;
  const isAgency = vertical === 'web_agency';
  const setupActive = useGettingStartedActive();
  const homeWidgets = workspaceData?.config.homeWidgets ?? [];
  const hasPackWidgets = homeWidgets.length > 0;
  const showWarranties = features?.warranties === true;
  const showEquipment = features?.equipment === true;
  const showInventory = features?.inventory === true;
  const showRenewalsWidget = hasPackWidgets
    ? homeWidgets.includes('renewals')
    : showWarranties;
  const showLowStockWidget = hasPackWidgets
    ? homeWidgets.includes('low_stock')
    : showInventory;
  const showSlaAtRiskWidget = hasPackWidgets
    ? homeWidgets.includes('sla_at_risk')
    : true;
  const showOpenWorkOrdersWidget = homeWidgets.includes('open_work_orders');
  const showDeliveryExceptionsWidget = homeWidgets.includes('delivery_exceptions');
  const customerLabel = terminology?.customer ?? 'Client';
  const ticketsLabel = terminology?.tickets ?? 'Tickets';
  const ticketLabel = terminology?.ticket ?? 'Ticket';
  const equipmentLabel = terminology?.equipment ?? 'Equipment';

  // Widgets and shortcuts follow the same role + plan rules as the nav and APIs
  const { data: session } = useSession();
  const role = session?.user?.role ?? '';
  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';
  const isTechnician = role === 'TECHNICIAN';
  const salesRole = ['ADMIN', 'SUPER_ADMIN', 'SALES', 'SUPPORT_MANAGER'].includes(role);
  const ticketsOn = useFeatureModule('TICKETS') !== false;
  const leadsOn = useFeatureModule('LEADS') !== false;
  const inventoryOn = useFeatureModule('INVENTORY') !== false;
  const equipmentOn = useFeatureModule('EQUIPMENT') !== false;
  const showSupportKpis = ticketsOn && ['ADMIN', 'SUPER_ADMIN', 'SUPPORT_MANAGER'].includes(role);
  const showLeadWidgets = leadsOn && salesRole;
  const canRenewals = showRenewalsWidget && ticketsOn && salesRole;
  const canLowStock = showLowStockWidget && inventoryOn && !isTechnician;

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
    enabled: !!slug && ticketsOn,
  });

  const { data: supportStats, isLoading: supportLoading } = useQuery({
    queryKey: ['support-stats', slug],
    queryFn: async () => {
      const response = await workspaceFetch('/api/dashboard/support-stats?days=30');
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!slug && showSupportKpis,
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
    enabled: !!slug && canRenewals,
  });

  const { data: inventoryAlerts } = useQuery({
    queryKey: ['inventory-alerts', slug],
    queryFn: async () => {
      const response = await workspaceFetch('/api/inventory/alerts');
      if (!response.ok) {
        return {
          lowStock: [] as Array<{
            product: { id: string; name: string; quantity: number; minQuantity: number };
          }>,
        };
      }
      const json = await response.json();
      return {
        lowStock: (json?.data?.lowStock ?? []) as Array<{
          product: { id: string; name: string; quantity: number; minQuantity: number };
        }>,
      };
    },
    enabled: !!slug && canLowStock,
  });

  // Workspaces that have never logged a ticket get no empty ticket widgets (KPIs of zeros,
  // an empty "Recent tickets" card); the Create menu still offers "New ticket".
  const ticketsKnown = ticketsOn && !ticketsLoading;
  const hasTickets = ticketsKnown && Array.isArray(recentTickets) && recentTickets.length > 0;
  const noTicketsYet = ticketsKnown && !hasTickets;
  const supportRole = ['SUPPORT_MANAGER', 'TECHNICIAN'].includes(role);
  const primaryAction: 'project' | 'ticket' | 'lead' | null = isAgency
    ? 'project'
    : ticketsOn && (hasTickets || supportRole || !showLeadWidgets || !ticketsKnown)
      ? 'ticket'
      : showLeadWidgets
        ? 'lead'
        : ticketsOn
          ? 'ticket'
          : null;
  const showTicketKpis = showSupportKpis && !noTicketsYet;
  const showRecentTickets = ticketsOn && !noTicketsYet;

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
    <div className="flex flex-col gap-4 sm:gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {setupActive
              ? 'Complete setup to activate your workspace.'
              : isAgency
                ? 'Overview of projects, pipeline, and clients.'
                : 'Overview of tickets, sales, and operations.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {primaryAction === 'project' ? (
            <Button asChild size="sm">
              <Link href={path('/dashboard/projects')}>
                <FolderKanban className="h-4 w-4" />
                New project
              </Link>
            </Button>
          ) : primaryAction === 'ticket' ? (
            <Button asChild size="sm">
              <Link href={path('/dashboard/tickets/new')}>
                <Ticket className="h-4 w-4" />
                New {ticketLabel.toLowerCase()}
              </Link>
            </Button>
          ) : primaryAction === 'lead' ? (
            <Button asChild size="sm">
              <Link href={path('/dashboard/leads/new')}>
                <Plus className="h-4 w-4" />
                New {terminology?.lead?.toLowerCase() ?? 'lead'}
              </Link>
            </Button>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Create
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {isAgency ? (
                <DropdownMenuItem asChild>
                  <Link href={path('/dashboard/projects')}>
                    <FolderKanban className="h-4 w-4 mr-2" />
                    New project
                  </Link>
                </DropdownMenuItem>
              ) : null}
              {showLeadWidgets && (
              <DropdownMenuItem asChild>
                <Link href={path('/dashboard/leads/new')}>
                  <Plus className="h-4 w-4 mr-2" />
                  New {terminology?.lead?.toLowerCase() ?? 'lead'}
                </Link>
              </DropdownMenuItem>
              )}
              {salesRole && (
              <DropdownMenuItem asChild>
                <Link href={path('/dashboard/customers/new')}>
                  <Users className="h-4 w-4 mr-2" />
                  Add {customerLabel.toLowerCase()}
                </Link>
              </DropdownMenuItem>
              )}
              {!isAgency && ticketsOn ? (
                <DropdownMenuItem asChild>
                  <Link href={path('/dashboard/tickets/new')}>
                    <Ticket className="h-4 w-4 mr-2" />
                    New {ticketLabel.toLowerCase()}
                  </Link>
                </DropdownMenuItem>
              ) : null}
              {showEquipment && equipmentOn && salesRole && (
                <DropdownMenuItem asChild>
                  <Link href={path('/dashboard/inventory/new')}>
                    <Package className="h-4 w-4 mr-2" />
                    Register {equipmentLabel.toLowerCase()}
                  </Link>
                </DropdownMenuItem>
              )}
              {showInventory && !showEquipment && !isAgency && inventoryOn && isAdmin && (
                <DropdownMenuItem asChild>
                  <Link href={path('/dashboard/inventory')}>
                    <Package className="h-4 w-4 mr-2" />
                    View inventory
                  </Link>
                </DropdownMenuItem>
              )}
              {isAdmin && (
              <DropdownMenuItem asChild>
                <Link href={path('/dashboard/employees/new')}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite teammate
                </Link>
              </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {profile && <ProfileCompletionBanner isComplete={profile.isComplete} />}
      <WorkspaceSetupPendingBanner />
      <GettingStartedChecklist />

      {/* Phones: modules sit below the day's numbers (the tab bar + menu already navigate) */}
      <div className="order-1 empty:hidden lg:order-none">
        <ModuleHubCards compact={setupActive} />
      </div>

      {showLeadWidgets && (
        <DailyEntryBanner
          loading={opsLoading}
          missing={!!opsToday && !opsToday.dailyEntry?.hasSalesActivityToday}
        />
      )}

      <AgentQueueCard />

      {isAdmin && (
        <AttendanceTodayCard
          loading={opsLoading}
          name={opsToday?.me?.name}
          attendance={opsToday?.attendance}
        />
      )}
      {showTicketKpis && (
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {supportLoading || ticketsLoading ? (
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
                <CardDescription className="flex min-w-0 items-center gap-1.5">
                  <Ticket className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">
                    {showOpenWorkOrdersWidget
                      ? 'Open work orders'
                      : showDeliveryExceptionsWidget
                        ? 'Open delivery / ops tickets'
                        : `Open ${ticketsLabel.toLowerCase()}`}
                  </span>
                </CardDescription>
                <CardTitle className="text-2xl sm:text-3xl font-semibold tabular-nums">
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
                  <Clock className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">SLA on track</span>
                </CardDescription>
                <CardTitle className="text-2xl sm:text-3xl font-semibold tabular-nums">
                  {supportStats?.sla?.complianceRate != null
                    ? `${supportStats.sla.complianceRate}%`
                    : '—'}
                </CardTitle>
              </CardHeader>
            </Card>
            {showSlaAtRiskWidget ? (
            <Card className="border-amber-200/80 dark:border-amber-900/60">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  SLA at risk
                </CardDescription>
                <CardTitle className="text-2xl sm:text-3xl font-semibold tabular-nums text-amber-700 dark:text-amber-400">
                  {supportStats?.sla?.atRisk ?? 0}
                </CardTitle>
              </CardHeader>
            </Card>
            ) : null}
            <Card className="border-destructive/25">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5 text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  SLA breached
                </CardDescription>
                <CardTitle className="text-2xl sm:text-3xl font-semibold tabular-nums text-destructive">
                  {supportStats?.sla?.breached ?? 0}
                </CardTitle>
              </CardHeader>
            </Card>
          </>
        )}
      </div>
      )}

      {statsLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
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
        stats && (
          <StatsCards
            stats={stats}
            omitOpenTickets
            showEquipment={showEquipment}
            labels={{
              customers: terminology?.customers ?? 'Clients',
              tickets: `Open ${ticketsLabel.toLowerCase()}`,
              leads: terminology?.leads ?? 'Pipeline leads',
              equipment: terminology?.equipment ?? 'Installed equipment',
            }}
          />
        )
      )}

      {canLowStock && (inventoryAlerts?.lowStock?.length ?? 0) > 0 && (
        <Card className="order-2 border-amber-200/80 dark:border-amber-900/60 lg:order-none">
          <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
            <div className="min-w-0">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-amber-700 dark:text-amber-400" />
                Low stock
              </CardTitle>
              <CardDescription>Products at or below minimum quantity</CardDescription>
            </div>
            <Button variant="ghost" size="sm" className="shrink-0" asChild>
              <Link href={path('/dashboard/inventory')}>Inventory</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {inventoryAlerts!.lowStock.slice(0, 6).map((row) => (
                <Link
                  key={row.product.id}
                  href={path('/dashboard/inventory')}
                  className="flex items-center justify-between gap-3 rounded-md border p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{row.product.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Min {row.product.minQuantity}
                    </p>
                  </div>
                  <Badge variant="secondary" className="shrink-0 tabular-nums">
                    {row.product.quantity} left
                  </Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {canRenewals && (renewalsData?.count ?? 0) > 0 && (
        <Card className="order-2 border-amber-200/80 dark:border-amber-900/60 lg:order-none">
          <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
            <div className="min-w-0">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-amber-700 dark:text-amber-400" />
                Contract renewals
              </CardTitle>
              <CardDescription>
                Coverage ending within 60 days or already overdue
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" className="shrink-0" asChild>
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
                          {humanizeEnum(c.type)}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {c.customer?.organizationName ?? customerLabel} · ends{' '}
                        {format(new Date(c.endDate), 'MMM d, yyyy')}
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

      {(showLeadWidgets || showRecentTickets) && (
      <div
        className={`order-2 grid gap-4 sm:gap-6 lg:order-none [&>*]:min-w-0 ${
          showLeadWidgets && showRecentTickets ? 'lg:grid-cols-2' : ''
        }`}
      >
        {showLeadWidgets && <LeadsChart />}

        {/* Phones: recent work comes before the chart */}
        {showRecentTickets && (
        <Card className="order-first lg:order-none">
          <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
            <div className="min-w-0">
              <CardTitle className="text-base">Recent {ticketsLabel.toLowerCase()}</CardTitle>
              <CardDescription>Latest requests in this workspace</CardDescription>
            </div>
            <Button variant="ghost" size="sm" className="shrink-0" asChild>
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
                          {ticket.customer?.organizationName ?? customerLabel} ·{' '}
                          {TICKET_STATUS_LABELS[ticket.status as keyof typeof TICKET_STATUS_LABELS] ??
                            humanizeEnum(ticket.status)}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <Badge variant={getPriorityVariant(ticket.priority)}>
                          {humanizeEnum(ticket.priority)}
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
        )}
      </div>
      )}
    </div>
  );
}
