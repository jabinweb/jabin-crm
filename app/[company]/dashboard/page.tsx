'use client';

import { useParams } from 'next/navigation';
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
import { workspaceSlugHeaders } from '@/lib/api/workspace-slug';

export default function WorkspaceDashboardPage() {
  const params = useParams<{ company: string }>();
  const slug = params.company;

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats', slug],
    queryFn: async () => {
      const response = await fetch('/api/dashboard/stats', {
        headers: workspaceSlugHeaders(slug),
      });
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
      const response = await fetch('/api/tickets?limit=5', {
        headers: workspaceSlugHeaders(slug),
      });
      if (!response.ok) return [];
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
        
        {/* Quick Action Navigation */}
        <div className="flex flex-wrap items-center gap-2 mt-4 md:mt-0">
          <Button asChild size="sm" className="font-bold uppercase tracking-widest text-[10px]">
            <Link href="/dashboard/customers/new">
              <Users className="w-3.5 h-3.5 mr-2" /> Add Client
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="font-bold uppercase tracking-widest text-[10px]">
            <Link href={`/${slug}/dashboard/leads`}>
              <Plus className="w-3.5 h-3.5 mr-2" /> New Lead
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="font-bold uppercase tracking-widest text-[10px]">
            <Link href={`/${slug}/dashboard/equipment/new`}>
              <Database className="w-3.5 h-3.5 mr-2" /> Add Equipment
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="font-bold uppercase tracking-widest text-[10px]">
            <Link href={`/${slug}/dashboard/tickets/new`}>
              <Ticket className="w-3.5 h-3.5 mr-2" /> Create Ticket
            </Link>
          </Button>
        </div>
      </div>

      {profile && <ProfileCompletionBanner isComplete={profile.isComplete} />}

      {stats && <StatsCards stats={stats} />}

      <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-7">
        <LeadsChart />

        <Card className="lg:col-span-3 shadow-none border-2 border-foreground/5 bg-background rounded-none">
          <CardHeader className="border-b border-foreground/5 bg-muted/5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-[12px] uppercase tracking-[0.2em] font-black text-foreground">Recent Support Tickets</CardTitle>
                <CardDescription className="text-[10px] mt-1 font-bold uppercase tracking-widest text-muted-foreground opacity-60">
                  Latest customer issues
                </CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm" className="text-[10px] font-bold uppercase tracking-widest">
                <Link href={`/${slug}/dashboard/tickets`}>View All</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {!recentTickets || recentTickets.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="mb-4 text-xs font-bold uppercase tracking-widest opacity-60">No tickets found</p>
                <Button asChild variant="outline" size="sm" className="text-[10px] font-bold uppercase tracking-widest">
                  <Link href={`/${slug}/dashboard/tickets/new`}>
                    Create a Ticket
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {recentTickets?.map((ticket: any) => (
                  <div key={ticket.id} className="flex items-center justify-between space-x-4 border-b border-foreground/5 pb-3 last:border-0 last:pb-0">
                    <div className="flex items-center space-x-4 min-w-0">
                        <div className={cn(
                          "w-2 h-2 rounded-none",
                          ticket.status === 'OPEN' ? "bg-red-500" :
                            ticket.status === 'IN_PROGRESS' ? "bg-amber-500" : "bg-emerald-500"
                        )} />
                        <div className="truncate">
                          <Link href={`/${slug}/dashboard/tickets/${ticket.id}`} className="text-sm font-black uppercase tracking-widest leading-none truncate hover:underline cursor-pointer">
                            {ticket.subject}
                          </Link>
                          <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground truncate mt-1">
                            {ticket.customer?.organizationName || 'Unknown Customer'}
                          </p>
                        </div>
                    </div>
                    <div className="flex items-center space-x-2">
                       <Badge variant={getPriorityVariant(ticket.priority)} className="text-[9px] rounded-none px-2 uppercase tracking-widest font-black">
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
