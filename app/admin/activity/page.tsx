import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { format } from "date-fns";
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
import { EmptyState } from "@/components/ui/empty-state";
import { Activity } from "lucide-react";
import { humanizeEnum } from "@/lib/format/humanize";

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

const ACTIVITY_TONES: Record<string, string> = {
  CREATED: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  EMAIL_SENT: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  EMAIL_OPENED: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300",
  EMAIL_CLICKED: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
  EMAIL_REPLIED: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  STATUS_CHANGED: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  ENRICHED: "bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300",
};

function activityTone(type: string) {
  return ACTIVITY_TONES[type] ?? "bg-muted text-muted-foreground";
}

function formatWhen(date: Date | string) {
  return format(new Date(date), "MMM d, yyyy · h:mm a");
}

export default async function ActivityPage() {
  const activities = await getActivityLogs();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Activity</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Latest 200 lead activities across all workspaces
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4" />
            Recent activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activities.length === 0 ? (
            <EmptyState
              icon={Activity}
              title="No activity yet"
              description="Lead activity (created, emailed, status changes) from every workspace will appear here."
              className="py-10"
            />
          ) : (
            <>
              <div className="divide-y rounded-md border md:hidden">
                {activities.map((activity: ActivityLogRow) => (
                  <div key={activity.id} className="space-y-1 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <Badge className={activityTone(activity.activityType)}>
                        {humanizeEnum(activity.activityType)}
                      </Badge>
                      <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                        {formatWhen(activity.createdAt)}
                      </span>
                    </div>
                    <p className="line-clamp-2 text-sm break-words">{activity.description}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {activity.user?.name || "System"}
                      {activity.lead ? ` · ${activity.lead.companyName}` : ""}
                    </p>
                  </div>
                ))}
              </div>
              <div className="hidden rounded-md border md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Activity</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Lead</TableHead>
                      <TableHead>When</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activities.map((activity: ActivityLogRow) => (
                      <TableRow key={activity.id}>
                        <TableCell>
                          <Badge className={activityTone(activity.activityType)}>
                            {humanizeEnum(activity.activityType)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm max-w-md truncate">{activity.description}</p>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p className="font-medium">{activity.user?.name || "System"}</p>
                            {activity.user && (
                              <p className="text-muted-foreground">{activity.user.email}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {activity.lead ? (
                            <div className="text-sm">
                              <p className="font-medium">{activity.lead.companyName}</p>
                              {activity.lead.email && (
                                <p className="text-muted-foreground">{activity.lead.email}</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="whitespace-nowrap text-sm text-muted-foreground">
                            {formatWhen(activity.createdAt)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
