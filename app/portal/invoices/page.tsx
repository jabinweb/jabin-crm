'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronLeft } from 'lucide-react';
import { formatCurrency } from '@/lib/currency';
import { FullTableSkeleton } from '@/components/loading';
import { PortalFeatureGuard } from '@/components/portal/portal-feature-guard';

type PortalInvoice = {
  id: string;
  invoiceNumber: string;
  title: string;
  status: string;
  currency: string;
  total: number;
  amountDue: number;
  dueDate: string;
  createdAt: string;
};

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'PAID') return 'default';
  if (status === 'OVERDUE') return 'destructive';
  if (status === 'PARTIAL') return 'secondary';
  return 'outline';
}

function InvoicesList() {
  const router = useRouter();
  const { data, isLoading } = useQuery({
    queryKey: ['portal-invoices'],
    queryFn: async () => {
      const res = await fetch('/api/portal/invoices');
      if (!res.ok) throw new Error('Failed to load invoices');
      return res.json() as Promise<{ invoices: PortalInvoice[] }>;
    },
  });

  if (isLoading) {
    return <FullTableSkeleton columnCount={5} rowCount={5} />;
  }

  const invoices = data?.invoices ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/portal')} className="rounded-none">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
          <p className="text-sm text-muted-foreground">View balances and payment instructions.</p>
        </div>
      </div>

      <Card className="border-none bg-white dark:bg-slate-900 shadow-none overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
              <TableRow className="hover:bg-transparent border-none">
                <TableHead className="pl-6">Invoice</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right pr-6">Amount due</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-20 text-muted-foreground italic">
                    No invoices yet.
                  </TableCell>
                </TableRow>
              ) : (
                invoices.map((inv) => (
                  <TableRow key={inv.id} className="border-slate-50 dark:border-slate-800">
                    <TableCell className="pl-6">
                      <Link href={`/portal/invoices/${inv.id}`} className="hover:underline">
                        <div className="font-medium">{inv.invoiceNumber}</div>
                        <div className="text-xs text-muted-foreground">{inv.title}</div>
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(inv.dueDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(inv.status)}>{inv.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {formatCurrency(inv.total, inv.currency as never)}
                    </TableCell>
                    <TableCell className="text-right pr-6 text-sm font-medium">
                      {formatCurrency(inv.amountDue, inv.currency as never)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export default function PortalInvoicesPage() {
  return (
    <PortalFeatureGuard
      feature="customerPortal"
      title="Invoices not available"
      description="Your provider has not enabled the customer portal for billing."
    >
      <InvoicesList />
    </PortalFeatureGuard>
  );
}
