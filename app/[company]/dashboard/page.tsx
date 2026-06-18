'use client';

import Link from 'next/link';
import { StatsCards } from '@/components/dashboard/stats-cards';
import { LeadsChart } from '@/components/dashboard/leads-chart';
import { ProfileCompletionBanner } from '@/components/dashboard/profile-completion-banner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Plus, Users, Ticket, Database } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';

export default function WorkspaceDashboardPage() {
  const { slug, path, workspaceFetch } = useWorkspacePaths();

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

  const { data: recentTickets } = useQuery({
    queryKey: ['recent-tickets', slug],
    queryFn: async () => {
      const response = await workspaceFetch('/api/tickets?limit=5');
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!slug,
  });

  const { data: supportStats } = useQuery({
    queryKey: ['support-stats', slug],
    queryFn: async () => {
      const response = await workspaceFetch('/api/dashboard/support-stats?days=30');
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!slug,
  });

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" />
      </div>
    );
  }

  const getPriorityVariant = (priority: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (priority) {
      case 'CRITICAL': return 'destructive';
      case 'HIGH': return 'default';
      case 'MEDIUM': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <div className="flex-1 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-baseline md:justify-between border-b pb-6">
        <div>
          <h2 className="text-2xl font-black tracking-tight uppercase text-foreground">Workspace Command Center</h2>
          <p className="text-muted-foreground text-xs mt-1 uppercase tracking-widest font-bold opacity-60">
            {slug?.toUpperCase()} &bull; Performance Overview
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 mt-4 md:mt-0">
          <Button asChild size="sm" className="font-bold uppercase tracking-widest text-[10px]">
            <Link href={path('/dashboard/customers/new')}>
              <Users className="w-3.5 h-3.5 mr-2" /> Add Client
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="font-bold uppercase tracking-widest text-[10px]">
            <Link href={path('/dashboard/leads')}>
              <Plus className="w-3.5 h-3.5 mr-2" /> New Lead
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="font-bold uppercase tracking-widest text-[10px]">
            <Link href={path('/dashboard/inventory/new')}>
              <Database className="w-3.5 h-3.5 mr-2" /> Add Equipment
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="font-bold uppercase tracking-widest text-[10px]">
            <Link href={path('/dashboard/tickets/new')}>
              <Ticket className="w-3.5 h-3.5 mr-2" /> Create Ticket
            </Link>
          </Button>
        </div>
      </div>

      {profile && <ProfileCompletionBanner isComplete={profile.isComplete} />}

      {stats && <StatsCards stats={stats} />}

      {supportStats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Open tickets</CardDescription>
              <CardTitle className="text-2xl">{supportStats.summary.openTickets}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>SLA compliance</CardDescription>
              <CardTitle className="text-2xl">{supportStats.sla.complianceRate}%</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>At risk</CardDescription>
              <CardTitle className="text-2xl text-amber-600">{supportStats.sla.atRisk}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>SLA breached</CardDescription>
              <CardTitle className="text-2xl text-destructive">{supportStats.sla.breached}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <LeadsChart />

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-black uppercase tracking-widest">Recent Tickets</CardTitle>
              <CardDescription>Latest support activity in this workspace</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href={path('/dashboard/tickets')}>View All</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {!recentTickets?.length ? (
              <div className="text-center py-8 space-y-3">
                <p className="text-sm text-muted-foreground">No tickets yet.</p>
                <Button asChild size="sm">
                  <Link href={path('/dashboard/tickets/new')}>
                    <Ticket className="w-4 h-4 mr-2" /> Create first ticket
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {recentTickets.map((ticket: { id: string; subject: string; priority: string; status: string }) => (
                  <div key={ticket.id} className="flex items-center justify-between gap-4 p-3 rounded-lg border bg-muted/20">
                    <div className="min-w-0 flex-1">
                      <Link href={path(`/dashboard/tickets/${ticket.id}`)} className="text-sm font-black uppercase tracking-widest leading-none truncate hover:underline cursor-pointer">
                        {ticket.subject}
                      </Link>
                      <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-widest">{ticket.status}</p>
                    </div>
                    <Badge variant={getPriorityVariant(ticket.priority)} className={cn('text-[10px] uppercase')}>
                      {ticket.priority}
                    </Badge>
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
