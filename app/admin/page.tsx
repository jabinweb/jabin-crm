import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  Mail,
  Database,
  DollarSign,
  TrendingUp,
  Activity,
} from "lucide-react";

async function getAdminStats(): Promise<{
  totalUsers: number;
  activeSubscriptions: number;
  totalLeads: number;
  totalEmailsSent: number;
  totalRevenue: number;
  recentUsers: RecentUserRow[];
  recentActivity: RecentActivityRow[];
}> {
  const [
    totalUsers,
    activeSubscriptions,
    totalLeads,
    totalEmailsSent,
    totalRevenue,
    recentUsers,
    recentActivity,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.subscription.count({
      where: { status: "ACTIVE" },
    }),
    prisma.lead.count(),
    prisma.emailLog.count({
      where: { status: "SENT" },
    }),
    prisma.payment.aggregate({
      where: { status: "CAPTURED" },
      _sum: { amount: true },
    }),
    prisma.user.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        role: true,
      },
    }),
    prisma.leadActivity.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: { name: true, email: true },
        },
        lead: {
          select: { companyName: true },
        },
      },
    }),
  ]);

  return {
    totalUsers,
    activeSubscriptions,
    totalLeads,
    totalEmailsSent,
    totalRevenue: (totalRevenue._sum.amount || 0) / 100, // Convert paise to rupees
    recentUsers: recentUsers as RecentUserRow[],
    recentActivity: recentActivity as RecentActivityRow[],
  };
}

export default async function AdminDashboard() {
  const stats = await getAdminStats();

  const statCards = [
    {
      title: "Total Users",
      value: stats.totalUsers.toLocaleString(),
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      title: "Active Subscriptions",
      value: stats.activeSubscriptions.toLocaleString(),
      icon: TrendingUp,
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      title: "Total Leads",
      value: stats.totalLeads.toLocaleString(),
      icon: Database,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
    {
      title: "Emails Sent",
      value: stats.totalEmailsSent.toLocaleString(),
      icon: Mail,
      color: "text-orange-600",
      bgColor: "bg-orange-100",
    },
    {
      title: "Total Revenue",
      value: `₹${stats.totalRevenue.toLocaleString()}`,
      icon: DollarSign,
      color: "text-emerald-600",
      bgColor: "bg-emerald-100",
    },
    {
      title: "System Status",
      value: "Healthy",
      icon: Activity,
      color: "text-cyan-600",
      bgColor: "bg-cyan-100",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Dashboard Overview</h2>
        <p className="text-gray-600 mt-1">
          Monitor and manage your application from here
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    {stat.title}
                  </p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">
                    {stat.value}
                  </p>
                </div>
                <div className={`p-3 rounded-none ${stat.bgColor}`}>
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Users */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Users</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stats.recentUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between border-b pb-3 last:border-0"
              >
                <div>
                  <p className="font-medium text-gray-900">{user.name || "N/A"}</p>
                  <p className="text-sm text-gray-600">{user.email}</p>
                </div>
                <div className="text-right">
                  <span className="px-2 py-1 text-xs font-semibold text-blue-600 bg-blue-100 rounded">
                    {user.role}
                  </span>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {stats.recentActivity.map((activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-3 border-b pb-3 last:border-0"
              >
                <div className="p-2 bg-gray-100 rounded">
                  <Activity className="w-4 h-4 text-gray-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {activity.activityType.replace(/_/g, " ")}
                  </p>
                  <p className="text-xs text-gray-600">
                    {activity.user?.name || "System"} • {activity.lead?.companyName || "N/A"}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(activity.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

