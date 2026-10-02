'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/ui/empty-state';
import { ArrowLeft, Download, Send, FileText, Edit, Receipt, Loader2, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/currency';
import { humanizeEnum } from '@/lib/crm/humanize-enum';
import { confirmAction } from '@/lib/confirm-action';
import { toast } from 'sonner';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { DetailSkeleton } from '@/components/loading';

interface QuotationItem {
  id: string;
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

interface Quotation {
  id: string;
  quotationNumber: string;
  title: string;
  description: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
  validUntil: string;
  status: string;
  currency: string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discount: number;
  total: number;
  terms: string;
  notes: string;
  items: QuotationItem[];
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
  acceptedAt?: string;
  rejectedAt?: string;
  lead?: {
    companyName: string;
  };
  deal?: {
    title: string;
  };
}

const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-500',
  SENT: 'bg-blue-500',
  VIEWED: 'bg-purple-500',
  ACCEPTED: 'bg-green-600',
  REJECTED: 'bg-red-500',
  EXPIRED: 'bg-orange-500',
  CONVERTED: 'bg-teal-600',
};

function formatDate(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : format(d, 'd MMM yyyy');
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : format(d, 'd MMM yyyy, h:mm a');
}

export default function QuotationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { path } = useWorkspacePaths();
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<'not_found' | 'failed' | null>(null);
  const [sending, setSending] = useState(false);
  const [converting, setConverting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const fetchQuotation = useCallback(async () => {
    try {
      const response = await fetch(`/api/quotations/${params.id}`);
      if (response.status === 404) {
        setLoadError('not_found');
        return;
      }
      if (!response.ok) throw new Error('Failed to fetch quotation');
      const data = await response.json();
      setQuotation(data);
      setLoadError(null);
    } catch (error) {
      console.error('Failed to fetch quotation:', error);
      setLoadError('failed');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    void fetchQuotation();
  }, [fetchQuotation]);

  const handleSendQuotation = async () => {
    const ok = await confirmAction({
      title: 'Send this quotation?',
      description: quotation?.customerEmail
        ? `It will be emailed to ${quotation.customerEmail}. You won't be able to edit it afterwards.`
        : "It will be emailed to the customer. You won't be able to edit it afterwards.",
      confirmLabel: 'Send quotation',
    });
    if (!ok) return;
    setSending(true);
    try {
      const response = await fetch(`/api/quotations/${params.id}/send`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to send quotation');
      toast.success('Quotation sent');
      void fetchQuotation();
    } catch (error) {
      console.error('Failed to send quotation:', error);
      toast.error('Failed to send quotation');
    } finally {
      setSending(false);
    }
  };

  const handleDownloadPDF = async () => {
    setDownloading(true);
    try {
      const response = await fetch(`/api/quotations/${params.id}/pdf`);
      if (!response.ok) throw new Error('Failed to generate PDF');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${quotation?.quotationNumber || 'quotation'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error('Failed to download PDF:', error);
      toast.error('Failed to download PDF');
    } finally {
      setDownloading(false);
    }
  };

  const handleConvertToInvoice = async () => {
    const ok = await confirmAction({
      title: 'Convert to invoice?',
      description: 'A new invoice due in 30 days will be created from this quotation.',
      confirmLabel: 'Create invoice',
    });
    if (!ok) return;
    setConverting(true);
    try {
      const response = await fetch(`/api/quotations/${params.id}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dueInDays: 30 }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to convert quotation');
      }
      toast.success('Invoice created from quotation');
      router.push(path(`/dashboard/invoices/${data.id}`));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to convert quotation');
    } finally {
      setConverting(false);
    }
  };

  const backButton = (
    <Button
      variant="ghost"
      size="icon"
      className="h-10 w-10 shrink-0"
      aria-label="Back to quotations"
      onClick={() => router.push(path('/dashboard/quotations'))}
    >
      <ArrowLeft className="w-4 h-4" />
    </Button>
  );

  if (loading) {
    return (
      <div className="max-w-5xl space-y-6">
        {backButton}
        <DetailSkeleton />
      </div>
    );
  }

  if (!quotation) {
    const notFound = loadError !== 'failed';
    return (
      <div className="max-w-5xl space-y-6">
        {backButton}
        <Card>
          <EmptyState
            icon={notFound ? FileText : AlertCircle}
            title={notFound ? 'Quotation not found' : "Couldn't load this quotation"}
            description={
              notFound
                ? 'It may have been deleted, or you may not have access to it.'
                : 'Check your connection and try again.'
            }
            actionLabel={notFound ? 'Back to quotations' : 'Retry'}
            onAction={
              notFound
                ? () => router.push(path('/dashboard/quotations'))
                : () => {
                    setLoading(true);
                    void fetchQuotation();
                  }
            }
          />
        </Card>
      </div>
    );
  }

  const currency = quotation.currency;

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
          {backButton}
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-semibold tracking-tight">
              {quotation.quotationNumber}
            </h1>
            {quotation.title ? (
              <p className="break-words text-sm text-muted-foreground">{quotation.title}</p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {quotation.status === 'DRAFT' && (
            <Button
              variant="outline"
              onClick={() => router.push(path(`/dashboard/quotations/${params.id}/edit`))}
              className="flex-1 sm:flex-none"
            >
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => void handleDownloadPDF()}
            disabled={downloading}
            className="flex-1 sm:flex-none"
          >
            {downloading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            Download PDF
          </Button>
          {quotation.status === 'DRAFT' && (
            <Button
              onClick={() => void handleSendQuotation()}
              disabled={sending}
              className="flex-1 sm:flex-none"
            >
              {sending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              {sending ? 'Sending…' : 'Send'}
            </Button>
          )}
          {quotation.status === 'ACCEPTED' && (
            <Button
              onClick={() => void handleConvertToInvoice()}
              disabled={converting}
              className="flex-1 sm:flex-none"
            >
              {converting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Receipt className="w-4 h-4 mr-2" />
              )}
              {converting ? 'Converting…' : 'Convert to invoice'}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="min-w-0 md:col-span-2 space-y-6">
          {/* Quotation Details */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">Quotation details</CardTitle>
                <Badge className={`${statusColors[quotation.status] ?? ''} text-white`}>
                  {humanizeEnum(quotation.status)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="min-w-0 break-words">
                  <p className="text-sm text-muted-foreground">Customer</p>
                  <p className="font-medium">{quotation.customerName}</p>
                  {quotation.customerEmail && (
                    <p className="text-sm text-muted-foreground">{quotation.customerEmail}</p>
                  )}
                  {quotation.customerPhone && (
                    <p className="text-sm text-muted-foreground">{quotation.customerPhone}</p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Valid until</p>
                  <p className="font-medium">{formatDate(quotation.validUntil)}</p>
                </div>
              </div>

              {quotation.description && (
                <div>
                  <p className="text-sm text-muted-foreground">Description</p>
                  <p className="text-sm whitespace-pre-line break-words">{quotation.description}</p>
                </div>
              )}

              {quotation.customerAddress && (
                <div>
                  <p className="text-sm text-muted-foreground">Address</p>
                  <p className="text-sm whitespace-pre-line break-words">{quotation.customerAddress}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Items */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Items</CardTitle>
            </CardHeader>
            <CardContent>
              {quotation.items.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No line items on this quotation.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[150px]">Item</TableHead>
                        <TableHead className="text-right min-w-[60px]">Qty</TableHead>
                        <TableHead className="text-right min-w-[100px]">Unit price</TableHead>
                        <TableHead className="text-right min-w-[100px]">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {quotation.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{item.name}</div>
                              {item.description && (
                                <div className="text-sm text-muted-foreground">{item.description}</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{item.quantity}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatCurrency(item.unitPrice, currency)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatCurrency(item.amount, currency)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              <Separator className="my-4" />

              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium tabular-nums">
                    {formatCurrency(quotation.subtotal, currency)}
                  </span>
                </div>

                {quotation.taxRate > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tax ({quotation.taxRate}%)</span>
                    <span className="font-medium tabular-nums">
                      {formatCurrency(quotation.taxAmount, currency)}
                    </span>
                  </div>
                )}

                {quotation.discount > 0 && (
                  <div className="flex justify-between text-green-600 dark:text-green-400">
                    <span>Discount</span>
                    <span className="tabular-nums">-{formatCurrency(quotation.discount, currency)}</span>
                  </div>
                )}

                <Separator />

                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span className="tabular-nums">{formatCurrency(quotation.total, currency)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Terms and Notes */}
          {(quotation.terms || quotation.notes) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Additional information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {quotation.terms && (
                  <div>
                    <p className="text-sm font-medium mb-1">Terms &amp; conditions</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-line break-words">{quotation.terms}</p>
                  </div>
                )}
                {quotation.notes && (
                  <div>
                    <p className="text-sm font-medium mb-1">Notes</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-line break-words">{quotation.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="min-w-0 space-y-6">
          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Created</p>
                <p className="text-sm font-medium">{formatDateTime(quotation.createdAt)}</p>
              </div>

              {quotation.sentAt && (
                <div>
                  <p className="text-sm text-muted-foreground">Sent</p>
                  <p className="text-sm font-medium">{formatDateTime(quotation.sentAt)}</p>
                </div>
              )}

              {quotation.acceptedAt && (
                <div className="text-green-600 dark:text-green-400">
                  <p className="text-sm">Accepted</p>
                  <p className="text-sm font-medium">{formatDateTime(quotation.acceptedAt)}</p>
                </div>
              )}

              {quotation.rejectedAt && (
                <div className="text-destructive">
                  <p className="text-sm">Rejected</p>
                  <p className="text-sm font-medium">{formatDateTime(quotation.rejectedAt)}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Related Information */}
          {(quotation.lead || quotation.deal) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Related</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {quotation.lead && (
                  <div>
                    <p className="text-sm text-muted-foreground">Lead</p>
                    <p className="text-sm font-medium">{quotation.lead.companyName}</p>
                  </div>
                )}
                {quotation.deal && (
                  <div>
                    <p className="text-sm text-muted-foreground">Deal</p>
                    <p className="text-sm font-medium">{quotation.deal.title}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
