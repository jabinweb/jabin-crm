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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, FileText, Send, DollarSign, AlertCircle, Eye, Download, MoreVertical, Edit } from "lucide-react";
import { useRouter } from "next/navigation";
import { useWorkspacePaths } from "@/hooks/use-workspace-paths";
import { formatCurrency } from "@/lib/currency";
import { toast } from "sonner";

interface Invoice {
  id: string;
  invoiceNumber: string;
  title: string;
  customerName: string;
  customerEmail: string;
  total: number;
  amountPaid: number;
  amountDue: number;
  currency: string;
  status: string;
  dueDate: string;
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
  PARTIAL: "bg-yellow-500",
  PAID: "bg-green-500",
  OVERDUE: "bg-red-500",
  CANCELLED: "bg-gray-400",
  REFUNDED: "bg-orange-500",
};

export default function InvoicesPage() {
  const router = useRouter();
  const { path } = useWorkspacePaths();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [invoicesRes, statsRes] = await Promise.all([
        fetch("/api/invoices"),
        fetch("/api/invoices/stats"),
      ]);
      
      const invoicesData = await invoicesRes.json();
      const statsData = await statsRes.json();
      
      setInvoices(invoicesData.invoices || []);
      setStats(statsData);
    } catch (error) {
      console.error("Failed to fetch invoices:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    return (
      <Badge className={statusColors[status]}>
        {status}
      </Badge>
    );
  };

  const handleDownload = async (invoiceId: string, invoiceNumber: string) => {
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/pdf`);
      if (!response.ok) throw new Error("Failed to download PDF");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success("Invoice downloaded successfully");
    } catch (error) {
      console.error("Error downloading invoice:", error);
      toast.error("Failed to download invoice");
    }
  };

  const handleSend = async (invoiceId: string) => {
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/send`, {
        method: "POST",
      });
      
      if (!response.ok) throw new Error("Failed to send invoice");
      
      const data = await response.json();
      toast.success("Invoice sent successfully");
      fetchData(); // Refresh the list
    } catch (error) {
      console.error("Error sending invoice:", error);
      toast.error("Failed to send invoice");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading invoices...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Invoices</h1>
          <p className="text-gray-500">Manage your invoices and payments</p>
        </div>
        <Button onClick={() => router.push(path("/dashboard/invoices/new"))}>
          <Plus className="w-4 h-4 mr-2" />
          Create Invoice
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Revenue</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(stats.totalRevenue, stats.currency || 'USD')}
              </div>
              <p className="text-xs text-gray-500">{stats.total} invoices</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Paid</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(stats.paidRevenue, stats.currency || 'USD')}
              </div>
              <p className="text-xs text-gray-500">{stats.paid} invoices</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Overdue</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(stats.overdueAmount, stats.currency || 'USD')}
              </div>
              <p className="text-xs text-gray-500">{stats.overdue} invoices</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pending</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {stats.pending}
              </div>
              <p className="text-xs text-gray-500">Awaiting payment</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All Invoices</CardTitle>
          <CardDescription>
            View and manage all your invoices
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No invoices yet</h3>
              <p className="text-gray-500 mb-4">
                Create your first invoice to get started
              </p>
              <Button onClick={() => router.push(path("/dashboard/invoices/new"))}>
                <Plus className="w-4 h-4 mr-2" />
                Create Invoice
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[120px]">Number</TableHead>
                    <TableHead className="min-w-[150px]">Title</TableHead>
                    <TableHead className="min-w-[150px]">Customer</TableHead>
                    <TableHead className="min-w-[100px]">Amount</TableHead>
                    <TableHead className="min-w-[100px]">Paid</TableHead>
                    <TableHead className="min-w-[100px]">Due</TableHead>
                    <TableHead className="min-w-[100px]">Status</TableHead>
                    <TableHead className="min-w-[120px]">Due Date</TableHead>
                    <TableHead className="min-w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-mono">
                      {invoice.invoiceNumber}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{invoice.title}</div>
                        {invoice.lead && (
                          <div className="text-sm text-gray-500">
                            {invoice.lead.companyName}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div>{invoice.customerName}</div>
                        <div className="text-sm text-gray-500">
                          {invoice.customerEmail}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {formatCurrency(invoice.total, invoice.currency as any)}
                    </TableCell>
                    <TableCell className="text-green-600">
                      {formatCurrency(invoice.amountPaid, invoice.currency as any)}
                    </TableCell>
                    <TableCell className="text-red-600">
                      {formatCurrency(invoice.amountDue, invoice.currency as any)}
                    </TableCell>
                    <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {new Date(invoice.dueDate).toLocaleDateString()}
                        {invoice.status === "OVERDUE" && (
                          <AlertCircle className="w-4 h-4 text-red-500" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => router.push(path(`/dashboard/invoices/${invoice.id}`))}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => router.push(path(`/dashboard/invoices/${invoice.id}/edit`))}
                          >
                            <Edit className="w-4 h-4 mr-2" />
                            Edit Invoice
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDownload(invoice.id, invoice.invoiceNumber)}
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Download PDF
                          </DropdownMenuItem>
                          {invoice.status === "DRAFT" && (
                            <DropdownMenuItem
                              onClick={() => handleSend(invoice.id)}
                            >
                              <Send className="w-4 h-4 mr-2" />
                              Send Invoice
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
