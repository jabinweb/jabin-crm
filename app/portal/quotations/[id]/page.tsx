'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { ChevronLeft, Download, Check, X } from 'lucide-react';
import { formatCurrency } from '@/lib/currency';
import { SectionSkeleton } from '@/components/loading';
import { PortalFeatureGuard } from '@/components/portal/portal-feature-guard';
import { toast } from 'sonner';

type QuotationDetail = {
  id: string;
  quotationNumber: string;
  title: string;
  description?: string | null;
  status: string;
  currency: string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discount: number;
  total: number;
  validUntil: string;
  terms?: string | null;
  notes?: string | null;
  items: Array<{
    id: string;
    name: string;
    description?: string | null;
    quantity: number;
    unitPrice: number;
    amount: number;
  }>;
};

function QuotationDetailView() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);

  const { data: quotation, isLoading, error } = useQuery({
    queryKey: ['portal-quotation', id],
    queryFn: async () => {
      const res = await fetch(`/api/portal/quotations/${id}`);
      if (!res.ok) throw new Error('Failed to load quotation');
      return res.json() as Promise<QuotationDetail>;
    },
  });

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/portal/quotations/${id}/accept`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to accept');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Quotation approved');
      queryClient.invalidateQueries({ queryKey: ['portal-quotation', id] });
      queryClient.invalidateQueries({ queryKey: ['portal-quotations'] });
      queryClient.invalidateQueries({ queryKey: ['portal-documents'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/portal/quotations/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason || undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to reject');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Quotation declined');
      setShowReject(false);
      queryClient.invalidateQueries({ queryKey: ['portal-quotation', id] });
      queryClient.invalidateQueries({ queryKey: ['portal-quotations'] });
      queryClient.invalidateQueries({ queryKey: ['portal-documents'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) {
    return <SectionSkeleton lines={8} className="py-4" />;
  }

  if (error || !quotation) {
    return (
      <div className="py-16 text-center space-y-4">
        <p className="text-muted-foreground">Quotation not found.</p>
        <Button variant="outline" asChild>
          <Link href="/portal/quotations">Back to quotations</Link>
        </Button>
      </div>
    );
  }

  const canDecide = quotation.status === 'SENT' || quotation.status === 'VIEWED';
  const expired = new Date(quotation.validUntil) < new Date();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/portal/quotations')}
            className="rounded-none"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{quotation.quotationNumber}</h1>
              <Badge variant="outline">{quotation.status}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{quotation.title}</p>
          </div>
        </div>
        <Button variant="outline" asChild>
          <a href={`/api/portal/quotations/${quotation.id}/pdf`} target="_blank" rel="noreferrer">
            <Download className="mr-2 h-4 w-4" />
            Download PDF
          </a>
        </Button>
      </div>

      {quotation.description ? (
        <p className="text-sm text-muted-foreground max-w-2xl">{quotation.description}</p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Line items</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Item</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit</TableHead>
                  <TableHead className="text-right pr-6">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotation.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="pl-6">
                      <div className="font-medium">{item.name}</div>
                      {item.description ? (
                        <div className="text-xs text-muted-foreground">{item.description}</div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(item.unitPrice, quotation.currency as never)}
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      {formatCurrency(item.amount, quotation.currency as never)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="space-y-2 border-t p-6 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(quotation.subtotal, quotation.currency as never)}</span>
              </div>
              {quotation.taxAmount > 0 ? (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax ({quotation.taxRate}%)</span>
                  <span>{formatCurrency(quotation.taxAmount, quotation.currency as never)}</span>
                </div>
              ) : null}
              {quotation.discount > 0 ? (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Discount</span>
                  <span>-{formatCurrency(quotation.discount, quotation.currency as never)}</span>
                </div>
              ) : null}
              <div className="flex justify-between font-semibold text-base pt-2">
                <span>Total</span>
                <span>{formatCurrency(quotation.total, quotation.currency as never)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Valid until</CardTitle>
              <CardDescription>
                {new Date(quotation.validUntil).toLocaleDateString()}
                {expired ? ' · Expired' : ''}
              </CardDescription>
            </CardHeader>
          </Card>

          {canDecide && !expired ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Your decision</CardTitle>
                <CardDescription>
                  Approving confirms you accept this quote. Your provider will follow up with an
                  invoice if needed.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  disabled={acceptMutation.isPending || rejectMutation.isPending}
                  onClick={() => acceptMutation.mutate()}
                >
                  <Check className="mr-2 h-4 w-4" />
                  Approve quote
                </Button>
                {!showReject ? (
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={acceptMutation.isPending || rejectMutation.isPending}
                    onClick={() => setShowReject(true)}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Decline
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <Textarea
                      placeholder="Optional reason..."
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      rows={3}
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="destructive"
                        className="flex-1"
                        disabled={rejectMutation.isPending}
                        onClick={() => rejectMutation.mutate()}
                      >
                        Confirm decline
                      </Button>
                      <Button variant="ghost" onClick={() => setShowReject(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}

          {quotation.terms ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Terms</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">{quotation.terms}</p>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function PortalQuotationDetailPage() {
  return (
    <PortalFeatureGuard
      feature="customerPortal"
      title="Quotations not available"
      description="Your provider has not enabled the customer portal for quotes."
    >
      <QuotationDetailView />
    </PortalFeatureGuard>
  );
}
