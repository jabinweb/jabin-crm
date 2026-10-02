import { prisma } from "@/lib/prisma";
import type { EmailLogStatus, Prisma } from "@prisma/client";
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
import { Mail, CheckCircle, XCircle, Clock } from "lucide-react";
import { humanizeEnum } from "@/lib/format/humanize";

type EmailLogRow = Prisma.EmailLogGetPayload<{
  include: {
    user: { select: { name: true; email: true } };
    lead: { select: { companyName: true } };
    campaign: { select: { name: true } };
  };
}>;

type EmailStatRow = { status: EmailLogStatus; _count: number };

async function getEmailLogs(): Promise<{
  emailLogs: EmailLogRow[];
  emailStats: EmailStatRow[];
}> {
  const [emailLogs, emailStats] = await Promise.all([
    prisma.emailLog.findMany({
      take: 100,
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
          },
        },
        campaign: {
          select: {
            name: true,
          },
        },
      },
    }),
    prisma.emailLog.groupBy({
      by: ["status"],
      _count: true,
    }),
  ]);

  return {
    emailLogs: emailLogs as EmailLogRow[],
    emailStats: emailStats as EmailStatRow[],
  };
}

const STATUS_TONES: Record<string, string> = {
  SENT: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  DELIVERED: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  OPENED: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  CLICKED: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  FAILED: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  BOUNCED: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  PENDING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300",
  REPLIED: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300",
};

function statusTone(status: string) {
  return STATUS_TONES[status] ?? "bg-muted text-muted-foreground";
}

function formatSentAt(date: Date | string | null) {
  return date ? format(new Date(date), "MMM d, yyyy · h:mm a") : "Not sent";
}

export default async function EmailLogsPage() {
  const { emailLogs, emailStats } = await getEmailLogs();

  const countFor = (status: EmailLogStatus) =>
    emailStats.find((s: EmailStatRow) => s.status === status)?._count || 0;

  const statCards = [
    {
      label: "Sent",
      value: countFor("SENT"),
      icon: CheckCircle,
      tone: "bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-300",
    },
    {
      label: "Delivered",
      value: countFor("DELIVERED"),
      icon: Mail,
      tone: "bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-300",
    },
    {
      label: "Failed",
      value: countFor("FAILED"),
      icon: XCircle,
      tone: "bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-300",
    },
    {
      label: "Pending",
      value: countFor("PENDING"),
      icon: Clock,
      tone: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Email logs</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Delivery activity across the platform (latest 100 messages)
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-3 sm:p-6">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-xs sm:text-sm font-medium text-muted-foreground">
                    {stat.label}
                  </p>
                  <p className="text-2xl sm:text-3xl font-semibold tabular-nums mt-1 sm:mt-2">
                    {stat.value.toLocaleString()}
                  </p>
                </div>
                <div className={`hidden sm:block shrink-0 rounded-md p-3 ${stat.tone}`}>
                  <stat.icon className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent email logs</CardTitle>
        </CardHeader>
        <CardContent>
          {emailLogs.length === 0 ? (
            <EmptyState
              icon={Mail}
              title="No emails logged yet"
              description="Emails sent from workspaces (campaigns, follow-ups, notifications) will be listed here."
              className="py-10"
            />
          ) : (
            <>
              <div className="divide-y rounded-md border md:hidden">
                {emailLogs.map((log) => (
                  <div key={log.id} className="space-y-1 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 truncate font-medium">{log.to}</p>
                      <Badge className={`shrink-0 ${statusTone(log.status)}`}>
                        {humanizeEnum(log.status)}
                      </Badge>
                    </div>
                    <p className="truncate text-sm">{log.subject}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {log.user.name || log.user.email}
                      {log.campaign ? ` · ${log.campaign.name}` : ""}
                      {log.lead ? ` · ${log.lead.companyName}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatSentAt(log.sentAt)}</p>
                  </div>
                ))}
              </div>
              <div className="hidden rounded-md border md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>To</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Campaign</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Sent</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {emailLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{log.to}</p>
                            {log.lead && (
                              <p className="text-sm text-muted-foreground">
                                {log.lead.companyName}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="max-w-xs truncate">{log.subject}</p>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p>{log.user.name || "Unnamed user"}</p>
                            <p className="text-muted-foreground">{log.user.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {log.campaign ? (
                            <span className="text-sm">{log.campaign.name}</span>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={statusTone(log.status)}>
                            {humanizeEnum(log.status)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="whitespace-nowrap text-sm text-muted-foreground">
                            {formatSentAt(log.sentAt)}
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
