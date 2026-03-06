'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Users, TrendingUp, Target, CheckCircle, DollarSign } from 'lucide-react';
import { useCurrency } from '@/hooks/use-currency';

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
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading team performance...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Team Performance</h1>
        <p className="text-gray-500">Track your team's sales and task performance</p>
      </div>

      {/* Team Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Team Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teamMembers.length}</div>
            <p className="text-xs text-muted-foreground">Active users</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStats.leads}</div>
            <p className="text-xs text-muted-foreground">Assigned to team</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Deals</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStats.deals}</div>
            <p className="text-xs text-muted-foreground">In pipeline</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
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
                  className="border rounded-lg p-6 space-y-4"
                >
                  {/* Member Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={member.image || ''} />
                        <AvatarFallback>
                          {member.name?.[0] || member.email[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-semibold">
                          {member.name || 'Unnamed User'}
                        </h3>
                        <p className="text-sm text-gray-500">{member.email}</p>
                      </div>
                    </div>
                    <Badge className="bg-purple-600">
                      {formatCurrency(member.stats.wonRevenue)}
                    </Badge>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                      <p className="text-sm text-gray-500 mb-1">Tasks</p>
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

                  {/* Task Completion Progress */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium">Task Completion Rate</p>
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
                      tasks completed
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
