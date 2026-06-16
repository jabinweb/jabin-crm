import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Activity } from "lucide-react";

type ActivityLogRow = Prisma.LeadActivityGetPayload<{
  include: {
    user: { select: { name: true; email: true } };
    lead: { select: { companyName: true; email: true } };
  };
}>;

async function getActivityLogs(): Promise<ActivityLogRow[]> {
  const activities = await prisma.leadActivity.findMany({
    take: 200,
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: {
          name: true,
          email: true,
        },
      },
      lead: {
        select: {
          companyName: true,
          email: true,
        },
      },
    },
  });

  return activities;
}

export default async function ActivityPage() {
  const activities = await getActivityLogs();

  const getActivityColor = (type: string) => {
    switch (type) {
      case "CREATED":
        return "bg-blue-100 text-blue-700";
      case "EMAIL_SENT":
        return "bg-purple-100 text-purple-700";
      case "EMAIL_OPENED":
        return "bg-cyan-100 text-cyan-700";
      case "EMAIL_CLICKED":
        return "bg-indigo-100 text-indigo-700";
      case "EMAIL_REPLIED":
        return "bg-green-100 text-green-700";
      case "STATUS_CHANGED":
        return "bg-orange-100 text-orange-700";
      case "ENRICHED":
        return "bg-pink-100 text-pink-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Activity Log</h2>
        <p className="text-gray-600 mt-1">
          View all system activities and user actions
        </p>
      </div>

      {/* Activity Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Recent Activity ({activities.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-none border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Activity</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Lead</TableHead>
                  <TableHead>Timestamp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activities.map((activity: ActivityLogRow) => (
                  <TableRow key={activity.id}>
                    <TableCell>
                      <Badge className={getActivityColor(activity.activityType)}>
                        {activity.activityType.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm max-w-md truncate">
                        {activity.description}
                      </p>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p className="font-medium">
                          {activity.user?.name || "System"}
                        </p>
                        {activity.user && (
                          <p className="text-gray-600">{activity.user.email}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {activity.lead ? (
                        <div className="text-sm">
                          <p className="font-medium">
                            {activity.lead.companyName}
                          </p>
                          {activity.lead.email && (
                            <p className="text-gray-600">
                              {activity.lead.email}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-600">
                        {new Date(activity.createdAt).toLocaleString()}
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

