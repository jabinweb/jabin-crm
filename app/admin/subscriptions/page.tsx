import { prisma } from "@/lib/prisma";
import type { Prisma, SubscriptionStatus } from "@prisma/client";

type SubscriptionRow = Prisma.SubscriptionGetPayload<{
  include: {
    user: { select: { id: true; name: true; email: true } };
    plan: true;
  };
}>;

type SubscriptionStatRow = {
  status: SubscriptionStatus;
  _count: number;
};
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DollarSign, Users, TrendingUp } from "lucide-react";

async function getSubscriptionData(): Promise<{
  subscriptions: SubscriptionRow[];
  subscriptionStats: SubscriptionStatRow[];
}> {
  const [subscriptions, subscriptionStats] = await Promise.all([
    prisma.subscription.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        plan: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.subscription.groupBy({
      by: ["status"],
      _count: true,
    }),
  ]);

  return {
    subscriptions: subscriptions as SubscriptionRow[],
    subscriptionStats: subscriptionStats as SubscriptionStatRow[],
  };
}

export default async function SubscriptionsPage() {
  const { subscriptions, subscriptionStats } = await getSubscriptionData();

  const activeCount =
    subscriptionStats.find((s: SubscriptionStatRow) => s.status === "ACTIVE")
      ?._count || 0;
  const trialingCount =
    subscriptionStats.find((s: SubscriptionStatRow) => s.status === "TRIALING")
      ?._count || 0;
  const canceledCount =
    subscriptionStats.find((s: SubscriptionStatRow) => s.status === "CANCELED")
      ?._count || 0;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "bg-green-100 text-green-700";
      case "TRIALING":
        return "bg-blue-100 text-blue-700";
      case "CANCELED":
        return "bg-red-100 text-red-700";
      case "PAST_DUE":
        return "bg-orange-100 text-orange-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Subscriptions</h2>
        <p className="text-gray-600 mt-1">
          Monitor all user subscriptions and their status
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {activeCount}
                </p>
              </div>
              <div className="p-3 rounded-none bg-green-100">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Trialing</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {trialingCount}
                </p>
              </div>
              <div className="p-3 rounded-none bg-blue-100">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Canceled</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {canceledCount}
                </p>
              </div>
              <div className="p-3 rounded-none bg-red-100">
                <DollarSign className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Subscriptions Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Subscriptions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-none border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptions.map((subscription) => (
                  <TableRow key={subscription.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {subscription.user.name || "N/A"}
                        </p>
                        <p className="text-sm text-gray-600">
                          {subscription.user.email}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {subscription.plan.displayName}
                        </p>
                        <p className="text-sm text-gray-600">
                          ₹{(subscription.plan.price / 100).toLocaleString()}/
                          {subscription.plan.interval}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(subscription.status)}>
                        {subscription.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p>
                          Start:{" "}
                          {new Date(
                            subscription.currentPeriodStart
                          ).toLocaleDateString()}
                        </p>
                        <p>
                          End:{" "}
                          {new Date(
                            subscription.currentPeriodEnd
                          ).toLocaleDateString()}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-600">
                        {new Date(subscription.createdAt).toLocaleDateString()}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

