'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { StatsCards } from '@/components/dashboard/stats-cards';
import { LeadsChart } from '@/components/dashboard/leads-chart';
import { ProfileCompletionBanner } from '@/components/dashboard/profile-completion-banner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Play, Pause, Check, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const response = await fetch('/api/dashboard/stats');
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json();
    },
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
    <div className="flex-1 space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight hidden lg:block">Dashboard</h2>
        <div className="flex items-center space-x-2">
          <Button asChild className="w-full sm:w-auto">
            <Link href="/dashboard/tickets/new">New Support Ticket</Link>
          </Button>
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/dashboard/customers/new">Add Customer</Link>
          </Button>
        </div>
      </div>

      {/* Profile Completion Banner */}
      {profile && <ProfileCompletionBanner isComplete={profile.isComplete} />}

      <StatsCards stats={stats!} />

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
                        "w-2 h-2 rounded-full",
                        ticket.status === 'OPEN' ? "bg-red-500" :
                          ticket.status === 'IN_PROGRESS' ? "bg-blue-500" : "bg-green-500"
                      )} />
                      <div className="truncate">
                        <p className="text-sm font-medium leading-none truncate">
                          {ticket.subject}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {ticket.customer.hospitalName}
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
