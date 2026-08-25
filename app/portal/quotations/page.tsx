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

type PortalQuotation = {
  id: string;
  quotationNumber: string;
  title: string;
  status: string;
  currency: string;
  total: number;
  validUntil: string;
  createdAt: string;
};

function QuotationsList() {
  const router = useRouter();
  const { data, isLoading } = useQuery({
    queryKey: ['portal-quotations'],
    queryFn: async () => {
      const res = await fetch('/api/portal/quotations');
      if (!res.ok) throw new Error('Failed to load quotations');
      return res.json() as Promise<{ quotations: PortalQuotation[] }>;
    },
  });

  if (isLoading) {
    return <FullTableSkeleton columnCount={5} rowCount={5} />;
  }

  const quotations = data?.quotations ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/portal')} className="rounded-none">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Quotations</h1>
          <p className="text-sm text-muted-foreground">Review and approve quotes from your provider.</p>
        </div>
      </div>

      <Card className="border-none bg-white dark:bg-slate-900 shadow-none overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
              <TableRow className="hover:bg-transparent border-none">
                <TableHead className="pl-6">Quote</TableHead>
                <TableHead>Valid until</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right pr-6">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-20 text-muted-foreground italic">
                    No quotations yet.
                  </TableCell>
                </TableRow>
              ) : (
                quotations.map((q) => (
                  <TableRow key={q.id} className="border-slate-50 dark:border-slate-800">
                    <TableCell className="pl-6">
                      <Link href={`/portal/quotations/${q.id}`} className="hover:underline">
                        <div className="font-medium">{q.quotationNumber}</div>
                        <div className="text-xs text-muted-foreground">{q.title}</div>
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(q.validUntil).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{q.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right pr-6 text-sm font-medium">
                      {formatCurrency(q.total, q.currency as never)}
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

export default function PortalQuotationsPage() {
  return (
    <PortalFeatureGuard
      feature="customerPortal"
      title="Quotations not available"
      description="Your provider has not enabled the customer portal for quotes."
    >
      <QuotationsList />
    </PortalFeatureGuard>
  );
}
