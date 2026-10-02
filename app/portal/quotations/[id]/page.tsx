'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Label } from '@/components/ui/label';
import { confirmAction } from '@/lib/confirm-action';
import { humanizeStatus } from '@/lib/portal/status-label';
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
import { ChevronLeft, Download, Check, X, FileWarning, Loader2 } from 'lucide-react';
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
  const queryClient = useQueryClient();
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);

  const { data: quotation, isLoading, error, refetch, isRefetching } = useQuery({
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

  const backLink = (
    <Button variant="ghost" size="icon" asChild className="-ml-3 rounded-none">
      <Link href="/portal/quotations" aria-label="Back to quotations">
        <ChevronLeft className="h-4 w-4" />
      </Link>
    </Button>
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        {backLink}
        <SectionSkeleton lines={8} className="py-4" />
      </div>
    );
  }

  if (error || !quotation) {
    return (
      <div className="space-y-4">
        {backLink}
        <EmptyState
          icon={FileWarning}
          title="We couldn't open this quotation"
          description="It may have been withdrawn, or the connection dropped. Try again, or go back to your quotations."
          actionLabel={isRefetching ? 'Retrying…' : 'Try again'}
          onAction={() => void refetch()}
        />
      </div>
    );
  }

  const canDecide = quotation.status === 'SENT' || quotation.status === 'VIEWED';
  const expired = new Date(quotation.validUntil) < new Date();
  const deciding = acceptMutation.isPending || rejectMutation.isPending;

  const handleApprove = async () => {
    const ok = await confirmAction({
      title: `Approve ${quotation.quotationNumber}?`,
      description: `You're accepting this quote for ${formatCurrency(quotation.total, quotation.currency as never)}. Your provider will be notified and may follow up with an invoice.`,
      confirmLabel: 'Approve quote',
    });
    if (ok) acceptMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 flex-col items-start gap-2">
          {backLink}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="text-2xl font-bold tracking-tight break-words min-w-0">{quotation.quotationNumber}</h1>
              <Badge variant="outline">
                {canDecide && expired ? 'Expired' : humanizeStatus(quotation.status)}
              </Badge>
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
        <Card className="lg:col-span-2 min-w-0">
          <CardHeader>
            <CardTitle className="text-base">Line items</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4 sm:pl-6">Item</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Qty</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Unit</TableHead>
                  <TableHead className="text-right pr-4 sm:pr-6">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotation.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="pl-4 sm:pl-6">
                      <div className="font-medium break-words">{item.name}</div>
                      {item.description ? (
                        <div className="text-xs text-muted-foreground">{item.description}</div>
                      ) : null}
                      <div className="mt-0.5 text-xs text-muted-foreground sm:hidden">
                        {item.quantity} × {formatCurrency(item.unitPrice, quotation.currency as never)}
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-right sm:table-cell">{item.quantity}</TableCell>
                    <TableCell className="hidden text-right sm:table-cell">
                      {formatCurrency(item.unitPrice, quotation.currency as never)}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap pr-4 sm:pr-6">
                      {formatCurrency(item.amount, quotation.currency as never)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="space-y-2 border-t p-4 sm:p-6 text-sm">
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
                {format(new Date(quotation.validUntil), 'd MMM yyyy')}
                {expired ? ' · Expired' : ''}
              </CardDescription>
            </CardHeader>
            {canDecide && expired ? (
              <CardContent className="text-sm text-muted-foreground">
                This quote can no longer be approved online. Contact your provider for an updated
                quote.
              </CardContent>
            ) : null}
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
                  className="w-full"
                  disabled={deciding}
                  onClick={() => void handleApprove()}
                >
                  {acceptMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="mr-2 h-4 w-4" />
                  )}
                  {acceptMutation.isPending ? 'Approving…' : 'Approve quote'}
                </Button>
                {!showReject ? (
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={deciding}
                    onClick={() => setShowReject(true)}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Decline
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="decline-reason">Reason for declining (optional)</Label>
                    <Textarea
                      id="decline-reason"
                      placeholder="e.g. Over budget, timing doesn't work…"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      rows={3}
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="destructive"
                        className="flex-1"
                        disabled={deciding}
                        onClick={() => rejectMutation.mutate()}
                      >
                        {rejectMutation.isPending ? 'Declining…' : 'Confirm decline'}
                      </Button>
                      <Button
                        variant="ghost"
                        disabled={rejectMutation.isPending}
                        onClick={() => setShowReject(false)}
                      >
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
