'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UserAvatar } from '@/components/ui/user-avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Users, TrendingUp, Target, CheckCircle, DollarSign } from 'lucide-react';
import { useCurrency } from '@/hooks/use-currency';
import { PageHeaderSkeleton, StatCardsSkeleton, CardListSkeleton } from '@/components/loading';

interface TeamMember {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  stats: {
    assignedLeads: number;
    assignedDeals: number;
    assignedTasks: number;
    completedTasks: number;
    wonDeals: number;
    wonRevenue: number;
    taskCompletionRate: number;
  };
}

export default function TeamPerformancePage() {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const { formatCurrency } = useCurrency();

  useEffect(() => {
    fetchTeamPerformance();
  }, []);

  const fetchTeamPerformance = async () => {
    try {
      const response = await fetch('/api/team/performance');
      if (response.ok) {
        const data = await response.json();
        setTeamMembers(data);
      }
    } catch (error) {
      console.error('Failed to fetch team performance:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalStats = teamMembers.reduce(
    (acc, member) => ({
      leads: acc.leads + member.stats.assignedLeads,
      deals: acc.deals + member.stats.assignedDeals,
      tasks: acc.tasks + member.stats.assignedTasks,
      revenue: acc.revenue + member.stats.wonRevenue,
    }),
    { leads: 0, deals: 0, tasks: 0, revenue: 0 }
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeaderSkeleton />
        <StatCardsSkeleton count={4} />
        <CardListSkeleton rows={5} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold mb-2 sm:text-3xl">Team Performance</h1>
        <p className="text-gray-500">
          Track sales pipeline and CRM follow-up tasks (not project delivery work)
        </p>
      </div>

      {/* Team Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="truncate text-sm font-medium">Total Team Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="break-words text-xl font-bold tabular-nums sm:text-2xl">{teamMembers.length}</div>
            <p className="text-xs text-muted-foreground">Active users</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="truncate text-sm font-medium">Total Leads</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="break-words text-xl font-bold tabular-nums sm:text-2xl">{totalStats.leads}</div>
            <p className="text-xs text-muted-foreground">Assigned to team</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="truncate text-sm font-medium">Total Deals</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="break-words text-xl font-bold tabular-nums sm:text-2xl">{totalStats.deals}</div>
            <p className="text-xs text-muted-foreground">In pipeline</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="truncate text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="break-words text-xl font-bold tabular-nums sm:text-2xl">
              {formatCurrency(totalStats.revenue)}
            </div>
            <p className="text-xs text-muted-foreground">Won deals</p>
          </CardContent>
        </Card>
      </div>

      {/* Team Member Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Individual Performance</CardTitle>
          <CardDescription>Detailed breakdown by team member</CardDescription>
        </CardHeader>
        <CardContent>
          {teamMembers.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>No team members found</p>
            </div>
          ) : (
            <div className="space-y-6">
              {teamMembers.map((member) => (
                <div
                  key={member.id}
                  className="border rounded-none p-4 space-y-4 sm:p-6"
                >
                  {/* Member Header */}
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-3">
                      <UserAvatar person={member} size="lg" />
                      <div className="min-w-0">
                        <h3 className="font-semibold">
                          {member.name || 'Unnamed User'}
                        </h3>
                        <p className="truncate text-sm text-gray-500">{member.email}</p>
                      </div>
                    </div>
                    <Badge className="bg-purple-600">
                      {formatCurrency(member.stats.wonRevenue)}
                    </Badge>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Leads</p>
                      <p className="text-2xl font-bold">
                        {member.stats.assignedLeads}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Deals</p>
                      <p className="text-2xl font-bold">
                        {member.stats.assignedDeals}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Sales follow-ups</p>
                      <p className="text-2xl font-bold">
                        {member.stats.assignedTasks}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Won Deals</p>
                      <p className="text-2xl font-bold text-green-600">
                        {member.stats.wonDeals}
                      </p>
                    </div>
                  </div>

                  {/* Sales follow-up completion (CRM Task model) */}
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <p className="text-sm font-medium">Follow-up completion rate</p>
                      <span className="text-sm font-bold">
                        {member.stats.taskCompletionRate.toFixed(1)}%
                      </span>
                    </div>
                    <Progress
                      value={member.stats.taskCompletionRate}
                      className="h-2"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {member.stats.completedTasks} of {member.stats.assignedTasks}{' '}
                      sales follow-ups completed
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

