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

  // Static page header: shown as-is while data loads (no skeleton for known text)
  const pageHeader = (
    <div className="flex flex-col items-start gap-2">
      <Button variant="ghost" size="icon" onClick={() => router.push('/portal')} className="-ml-3 rounded-none">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
        <p className="text-sm text-muted-foreground">View balances and payment instructions.</p>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        {pageHeader}
        <FullTableSkeleton columnCount={5} rowCount={5} />
      </div>
    );
  }

  const invoices = data?.invoices ?? [];

  return (
    <div className="space-y-6">
      {pageHeader}

      <Card className="border-none bg-white dark:bg-slate-900 shadow-none overflow-hidden">
        <CardContent className="p-0">
          <div className="divide-y md:hidden">
            {invoices.length === 0 ? (
              <p className="py-12 text-center text-sm italic text-muted-foreground">No invoices yet.</p>
            ) : (
              invoices.map((inv) => (
                <Link
                  key={inv.id}
                  href={`/portal/invoices/${inv.id}`}
                  className="block space-y-1 p-4 hover:bg-muted/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{inv.invoiceNumber}</p>
                      <p className="truncate text-xs text-muted-foreground">{inv.title}</p>
                    </div>
                    <Badge variant={statusVariant(inv.status)} className="shrink-0">{inv.status}</Badge>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <span>Due {new Date(inv.dueDate).toLocaleDateString()}</span>
                    <span className="text-sm font-medium tabular-nums text-foreground">
                      {formatCurrency(inv.amountDue, inv.currency as never)}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
          <div className="hidden md:block">
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
          </div>
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
