import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Users,
  Mail,
  Building2,
  DollarSign,
  TrendingUp,
  Activity,
  ArrowRight,
  CreditCard,
} from 'lucide-react';

type RecentUserRow = Prisma.UserGetPayload<{
  select: {
    id: true;
    name: true;
    email: true;
    createdAt: true;
    role: true;
  };
}>;

type RecentActivityRow = Prisma.LeadActivityGetPayload<{
  include: {
    user: { select: { name: true; email: true } };
    lead: { select: { companyName: true } };
  };
}>;

async function getAdminStats(): Promise<{
  totalUsers: number;
  totalCompanies: number;
  activeSubscriptions: number;
  totalLeads: number;
  totalEmailsSent: number;
  totalRevenue: number;
  recentUsers: RecentUserRow[];
  recentActivity: RecentActivityRow[];
}> {
  const [
    totalUsers,
    totalCompanies,
    activeSubscriptions,
    totalLeads,
    totalEmailsSent,
    totalRevenue,
    recentUsers,
    recentActivity,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.company.count(),
    prisma.subscription.count({ where: { status: 'ACTIVE' } }),
    prisma.lead.count(),
    prisma.emailLog.count({ where: { status: 'SENT' } }),
    prisma.payment.aggregate({
      where: { status: 'CAPTURED' },
      _sum: { amount: true },
    }),
    prisma.user.findMany({
      take: 6,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        role: true,
      },
    }),
    prisma.leadActivity.findMany({
      take: 8,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { name: true, email: true } },
        lead: { select: { companyName: true } },
      },
    }),
  ]);

  return {
    totalUsers,
    totalCompanies,
    activeSubscriptions,
    totalLeads,
    totalEmailsSent,
    totalRevenue: (totalRevenue._sum.amount || 0) / 100,
    recentUsers: recentUsers as RecentUserRow[],
    recentActivity: recentActivity as RecentActivityRow[],
  };
}

function roleTone(role: string): 'default' | 'secondary' | 'outline' {
  if (role === 'SUPER_ADMIN' || role === 'ADMIN') return 'default';
  if (role === 'TECHNICIAN') return 'secondary';
  return 'outline';
}

export default async function AdminDashboard() {
  const stats = await getAdminStats();

  const kpis = [
    {
      title: 'Companies',
      value: stats.totalCompanies.toLocaleString(),
      hint: 'Workspaces on the platform',
      icon: Building2,
      href: '/admin/companies',
    },
    {
      title: 'Users',
      value: stats.totalUsers.toLocaleString(),
      hint: 'All accounts',
      icon: Users,
      href: '/admin/users',
    },
    {
      title: 'Active subscriptions',
      value: stats.activeSubscriptions.toLocaleString(),
      hint: 'Paying / trial active',
      icon: TrendingUp,
      href: '/admin/subscriptions',
    },
    {
      title: 'Revenue captured',
      value: `₹${stats.totalRevenue.toLocaleString()}`,
      hint: 'Successful payments',
      icon: DollarSign,
      href: '/admin/subscriptions',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Platform health across workspaces, users, and billing.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/companies">
              <Building2 className="h-4 w-4 mr-1.5" />
              Companies
            </Link>
          </Button>
          <Button asChild size="sm" className="bg-teal-700 hover:bg-teal-800">
            <Link href="/admin/users">
              <Users className="h-4 w-4 mr-1.5" />
              Manage users
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {kpis.map((kpi) => (
          <Link key={kpi.title} href={kpi.href} className="group">
            <Card className="h-full transition-colors group-hover:border-teal-700/30">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">{kpi.title}</p>
                    <p className="text-2xl font-semibold tracking-tight mt-1">{kpi.value}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">{kpi.hint}</p>
                  </div>
                  <div className="rounded-md bg-teal-700/10 p-2 text-teal-800">
                    <kpi.icon className="h-4 w-4" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base">Recent users</CardTitle>
                <CardDescription>Newest accounts on the platform</CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href="/admin/users">
                  View all
                  <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="divide-y rounded-md border">
              {stats.recentUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between gap-3 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{user.name || 'Unnamed'}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={roleTone(user.role)} className="capitalize">
                      {user.role.replaceAll('_', ' ').toLowerCase()}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground tabular-nums w-16 text-right">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
              {stats.recentUsers.length === 0 && (
                <p className="px-3 py-6 text-sm text-muted-foreground text-center">
                  No users yet.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Pulse</CardTitle>
            <CardDescription>Secondary platform signals</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-md border px-3 py-2.5">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                Emails sent
              </div>
              <span className="text-sm font-semibold tabular-nums">
                {stats.totalEmailsSent.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-md border px-3 py-2.5">
              <div className="flex items-center gap-2 text-sm">
                <Activity className="h-4 w-4 text-muted-foreground" />
                Leads (all tenants)
              </div>
              <span className="text-sm font-semibold tabular-nums">
                {stats.totalLeads.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-md border px-3 py-2.5">
              <div className="flex items-center gap-2 text-sm">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                System
              </div>
              <Badge className="bg-teal-700 hover:bg-teal-700">Healthy</Badge>
            </div>
            <Button asChild variant="outline" className="w-full" size="sm">
              <Link href="/admin/settings">Platform settings</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">Recent activity</CardTitle>
              <CardDescription>Latest lead activity across workspaces</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin/activity">
                Activity log
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="divide-y rounded-md border">
            {stats.recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3 px-3 py-2.5">
                <div className="mt-0.5 rounded-md bg-muted p-1.5">
                  <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium capitalize">
                    {activity.activityType.replaceAll('_', ' ').toLowerCase()}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {activity.user?.name || 'System'}
                    {activity.lead?.companyName ? ` · ${activity.lead.companyName}` : ''}
                  </p>
                </div>
                <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                  {new Date(activity.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
            {stats.recentActivity.length === 0 && (
              <p className="px-3 py-6 text-sm text-muted-foreground text-center">
                No recent activity.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
