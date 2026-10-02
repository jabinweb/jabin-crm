"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText, Send, CheckCircle, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useWorkspacePaths } from "@/hooks/use-workspace-paths";
import { formatCurrency } from "@/lib/currency";
import { FullTableSkeleton } from "@/components/loading";
import { EmptyState } from "@/components/ui/empty-state";

interface Quotation {
  id: string;
  quotationNumber: string;
  title: string;
  customerName: string;
  customerEmail: string;
  total: number;
  currency: string;
  status: string;
  validUntil: string;
  createdAt: string;
  lead?: {
    companyName: string;
  };
  deal?: {
    title: string;
  };
}

const statusColors: Record<string, string> = {
  DRAFT: "bg-gray-500",
  SENT: "bg-blue-500",
  VIEWED: "bg-purple-500",
  ACCEPTED: "bg-green-500",
  REJECTED: "bg-red-500",
  EXPIRED: "bg-orange-500",
  CONVERTED: "bg-teal-500",
};

const statusIcons: Record<string, any> = {
  DRAFT: FileText,
  SENT: Send,
  VIEWED: FileText,
  ACCEPTED: CheckCircle,
  REJECTED: XCircle,
  EXPIRED: XCircle,
  CONVERTED: CheckCircle,
};

export default function QuotationsPage() {
  const router = useRouter();
  const { path } = useWorkspacePaths();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchQuotations();
  }, []);

  const fetchQuotations = async () => {
    try {
      const response = await fetch("/api/quotations");
      const data = await response.json();
      setQuotations(data.quotations || []);
    } catch (error) {
      console.error("Failed to fetch quotations:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const Icon = statusIcons[status] || FileText;
    return (
      <Badge className={statusColors[status]}>
        <Icon className="w-3 h-3 mr-1" />
        {status}
      </Badge>
    );
  };

  if (loading) {
    return <FullTableSkeleton columnCount={6} rowCount={6} withHeader />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold">Quotations</h1>
          <p className="text-sm md:text-base text-gray-500">Manage your quotations and proposals</p>
        </div>
        <Button onClick={() => router.push(path("/dashboard/quotations/new"))} className="w-full sm:w-auto">
          <Plus className="w-4 h-4 mr-2" />
          Create Quotation
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Quotations</CardTitle>
          <CardDescription>
            View and manage all your quotations
          </CardDescription>
        </CardHeader>
        <CardContent>
          {quotations.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No quotations yet"
              description="Create your first quotation to get started."
              actionLabel="Create Quotation"
              actionHref={path("/dashboard/quotations/new")}
            />
          ) : (
            <>
            <div className="divide-y rounded-md border md:hidden">
              {quotations.map((quotation) => (
                <button
                  key={quotation.id}
                  type="button"
                  className="block w-full space-y-1 p-3 text-left active:bg-muted/50"
                  onClick={() =>
                    router.push(path(`/dashboard/quotations/${quotation.id}`))
                  }
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{quotation.title}</p>
                      <p className="truncate text-xs text-gray-500">
                        <span className="font-mono">{quotation.quotationNumber}</span> · {quotation.customerName}
                      </p>
                    </div>
                    <span className="shrink-0">{getStatusBadge(quotation.status)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="tabular-nums font-medium">
                      {formatCurrency(quotation.total, quotation.currency as any)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(quotation.validUntil).toLocaleDateString()}
                    </span>
                  </div>
                </button>
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[120px]">Number</TableHead>
                    <TableHead className="min-w-[150px]">Title</TableHead>
                    <TableHead className="min-w-[150px]">Customer</TableHead>
                    <TableHead className="min-w-[100px]">Amount</TableHead>
                    <TableHead className="min-w-[100px]">Status</TableHead>
                    <TableHead className="min-w-[120px]">Valid Until</TableHead>
                    <TableHead className="min-w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                {quotations.map((quotation) => (
                  <TableRow key={quotation.id}>
                    <TableCell className="font-mono">
                      {quotation.quotationNumber}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{quotation.title}</div>
                        {quotation.lead && (
                          <div className="text-sm text-gray-500">
                            {quotation.lead.companyName}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div>{quotation.customerName}</div>
                        <div className="text-sm text-gray-500">
                          {quotation.customerEmail}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {formatCurrency(quotation.total, quotation.currency as any)}
                    </TableCell>
                    <TableCell>{getStatusBadge(quotation.status)}</TableCell>
                    <TableCell>
                      {new Date(quotation.validUntil).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          router.push(path(`/dashboard/quotations/${quotation.id}`))
                        }
                      >
                        View
                      </Button>
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
