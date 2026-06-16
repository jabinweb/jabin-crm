import { prisma } from "@/lib/prisma";
import type { EmailLogStatus, Prisma } from "@prisma/client";

type EmailLogRow = Prisma.EmailLogGetPayload<{
  include: {
    user: { select: { name: true; email: true } };
    lead: { select: { companyName: true } };
    campaign: { select: { name: true } };
  };
}>;

type EmailStatRow = { status: EmailLogStatus; _count: number };
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
import { Mail, CheckCircle, XCircle, Clock } from "lucide-react";

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

export default async function EmailLogsPage() {
  const { emailLogs, emailStats } = await getEmailLogs();

  const sentCount = emailStats.find((s: EmailStatRow) => s.status === "SENT")?._count || 0;
  const deliveredCount = emailStats.find((s: EmailStatRow) => s.status === "DELIVERED")?._count || 0;
  const failedCount = emailStats.find((s: EmailStatRow) => s.status === "FAILED")?._count || 0;
  const pendingCount = emailStats.find((s: EmailStatRow) => s.status === "PENDING")?._count || 0;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "SENT":
      case "DELIVERED":
        return "bg-green-100 text-green-700";
      case "OPENED":
        return "bg-blue-100 text-blue-700";
      case "CLICKED":
        return "bg-purple-100 text-purple-700";
      case "FAILED":
      case "BOUNCED":
        return "bg-red-100 text-red-700";
      case "PENDING":
        return "bg-yellow-100 text-yellow-700";
      case "REPLIED":
        return "bg-cyan-100 text-cyan-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Email Logs</h2>
        <p className="text-gray-600 mt-1">
          Monitor all email activity across the platform
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Sent</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {sentCount}
                </p>
              </div>
              <div className="p-3 rounded-none bg-green-100">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Delivered</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {deliveredCount}
                </p>
              </div>
              <div className="p-3 rounded-none bg-blue-100">
                <Mail className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Failed</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {failedCount}
                </p>
              </div>
              <div className="p-3 rounded-none bg-red-100">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {pendingCount}
                </p>
              </div>
              <div className="p-3 rounded-none bg-yellow-100">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Email Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Email Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-none border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>To</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {emailLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{log.to}</p>
                        {log.lead && (
                          <p className="text-sm text-gray-600">
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
                        <p>{log.user.name || "N/A"}</p>
                        <p className="text-gray-600">{log.user.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {log.campaign ? (
                        <span className="text-sm">{log.campaign.name}</span>
                      ) : (
                        <span className="text-sm text-gray-500">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(log.status)}>
                        {log.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-600">
                        {log.sentAt
                          ? new Date(log.sentAt).toLocaleString()
                          : "-"}
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

