'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  Download,
  Send,
  Banknote,
  Briefcase,
  User,
  Mail,
  Phone,
  MapPin,
  Edit,
  Loader2,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/currency';
import { humanizeEnum } from '@/lib/crm/humanize-enum';
import { confirmAction } from '@/lib/confirm-action';
import { EmptyState } from '@/components/ui/empty-state';
import { toast } from 'sonner';
import { DashboardLink } from '@/components/navigation/dashboard-link';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { DetailSkeleton } from '@/components/loading';

function formatDate(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : format(d, 'd MMM yyyy');
}

interface InvoiceItem {
  id: string;
  name: string;
  description: string | null;
  quantity: number;
  unitPrice: number;
  amount: number;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  title: string;
  description: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  customerAddress: string | null;
  customerId?: string | null;
  status: string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discount: number;
  total: number;
  amountPaid: number;
  amountDue: number;
  currency: string;
  dueDate: string;
  createdAt: string;
  sentAt: string | null;
  paidAt: string | null;
  terms: string | null;
  notes: string | null;
  items: InvoiceItem[];
  customer?: { id: string; organizationName: string } | null;
  deal?: { id: string; title: string; stage?: string } | null;
  user: {
    name: string | null;
    email: string | null;
    profile: {
      companyName: string | null;
      companyEmail: string | null;
      companyPhone: string | null;
      companyAddress: string | null;
    } | null;
  };
}

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { path } = useWorkspacePaths();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [payOpen, setPayOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('BANK_TRANSFER');
  const [paymentNote, setPaymentNote] = useState('');
  const [loadError, setLoadError] = useState<'not_found' | 'failed' | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [sending, setSending] = useState(false);

  const fetchInvoice = useCallback(async () => {
    try {
      const response = await fetch(`/api/invoices/${params.id}`);
      if (response.status === 404) {
        setLoadError('not_found');
        return;
      }
      if (!response.ok) throw new Error('Failed to fetch invoice');
      const data = await response.json();
      setInvoice(data);
      setLoadError(null);
      if (data.amountDue > 0) {
        setPaymentAmount(String(data.amountDue));
      }
    } catch (error) {
      console.error('Error fetching invoice:', error);
      setLoadError('failed');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    void fetchInvoice();
  }, [fetchInvoice]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const response = await fetch(`/api/invoices/${params.id}/pdf`);
      if (!response.ok) throw new Error('Failed to download invoice');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${invoice?.invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);

      toast.success('Invoice downloaded');
    } catch (error) {
      toast.error('Failed to download invoice');
      console.error(error);
    } finally {
      setDownloading(false);
    }
  };

  const handleSend = async () => {
    const ok = await confirmAction({
      title: 'Send this invoice?',
      description: invoice?.customerEmail
        ? `It will be emailed to ${invoice.customerEmail}.`
        : 'It will be emailed to the customer.',
      confirmLabel: 'Send invoice',
    });
    if (!ok) return;
    setSending(true);
    try {
      const response = await fetch(`/api/invoices/${params.id}/send`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to send invoice');

      toast.success('Invoice sent');
      void fetchInvoice();
    } catch (error) {
      toast.error('Failed to send invoice');
      console.error(error);
    } finally {
      setSending(false);
    }
  };

  const handleRecordPayment = async () => {
    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter a valid payment amount');
      return;
    }
    if (invoice && amount > invoice.amountDue + 0.001) {
      toast.error('Amount cannot exceed amount due');
      return;
    }

    setRecording(true);
    try {
      const response = await fetch(`/api/invoices/${params.id}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          paymentMethod,
          paymentDetails: paymentNote || undefined,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to record payment');
      }
      toast.success('Payment recorded');
      setPayOpen(false);
      setPaymentNote('');
      await fetchInvoice();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to record payment');
    } finally {
      setRecording(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<
      string,
      { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }
    > = {
      DRAFT: { variant: 'secondary', label: 'Draft' },
      SENT: { variant: 'default', label: 'Sent' },
      VIEWED: { variant: 'outline', label: 'Viewed' },
      PAID: { variant: 'default', label: 'Paid' },
      PARTIAL: { variant: 'outline', label: 'Partially paid' },
      OVERDUE: { variant: 'destructive', label: 'Overdue' },
      CANCELLED: { variant: 'secondary', label: 'Cancelled' },
    };
    const config = statusConfig[status] || { variant: 'secondary' as const, label: humanizeEnum(status) };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const backButton = (
    <DashboardLink href="/dashboard/invoices">
      <Button variant="outline" size="sm">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>
    </DashboardLink>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        {backButton}
        <DetailSkeleton />
      </div>
    );
  }

  if (!invoice) {
    const notFound = loadError !== 'failed';
    return (
      <div className="space-y-6">
        {backButton}
        <Card>
          <EmptyState
            icon={notFound ? FileText : AlertCircle}
            title={notFound ? 'Invoice not found' : "Couldn't load this invoice"}
            description={
              notFound
                ? 'It may have been deleted, or you may not have access to it.'
                : 'Check your connection and try again.'
            }
            actionLabel={notFound ? 'Back to invoices' : 'Retry'}
            onAction={
              notFound
                ? () => router.push(path('/dashboard/invoices'))
                : () => {
                    setLoading(true);
                    void fetchInvoice();
                  }
            }
          />
        </Card>
      </div>
    );
  }

  const canRecordPayment =
    invoice.amountDue > 0 && !['PAID', 'CANCELLED', 'DRAFT', 'REFUNDED'].includes(invoice.status);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-4">
          {backButton}
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-semibold tracking-tight">
              Invoice {invoice.invoiceNumber}
            </h1>
            {invoice.title ? (
              <p className="break-words text-sm text-muted-foreground">{invoice.title}</p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => router.push(path(`/dashboard/invoices/${params.id}/edit`))}
          >
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button variant="outline" onClick={() => void handleDownload()} disabled={downloading}>
            {downloading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Download PDF
          </Button>
          {canRecordPayment && (
            <Button
              variant="outline"
              onClick={() => {
                setPaymentAmount(String(invoice.amountDue));
                setPayOpen(true);
              }}
            >
              <Banknote className="mr-2 h-4 w-4" />
              Record payment
            </Button>
          )}
          {invoice.status === 'DRAFT' && (
            <Button onClick={() => void handleSend()} disabled={sending}>
              {sending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              {sending ? 'Sending…' : 'Send invoice'}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">Invoice details</CardTitle>
                {getStatusBadge(invoice.status)}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Invoice number</p>
                  <p className="font-mono font-semibold">{invoice.invoiceNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Issue date</p>
                  <p className="font-semibold">{formatDate(invoice.createdAt)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Due date</p>
                  <p className="font-semibold">{formatDate(invoice.dueDate)}</p>
                </div>
                {invoice.sentAt && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Sent on</p>
                    <p className="font-semibold">{formatDate(invoice.sentAt)}</p>
                  </div>
                )}
                {invoice.paidAt && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Paid on</p>
                    <p className="font-semibold">{formatDate(invoice.paidAt)}</p>
                  </div>
                )}
              </div>

              {invoice.description && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Description</p>
                    <p className="whitespace-pre-wrap break-words">{invoice.description}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Customer information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0 break-words">
                  {(invoice.customer?.id || invoice.customerId) ? (
                    <DashboardLink
                      href={`/dashboard/customers/${invoice.customer?.id || invoice.customerId}`}
                      className="font-semibold underline-offset-2 hover:underline"
                    >
                      {invoice.customer?.organizationName || invoice.customerName}
                    </DashboardLink>
                  ) : (
                    <p className="font-semibold">{invoice.customerName}</p>
                  )}
                </div>
              </div>
              {invoice.deal?.id ? (
                <div className="flex items-start gap-3">
                  <Briefcase className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Deal</p>
                    <DashboardLink
                      href={`/dashboard/deals/${invoice.deal.id}`}
                      className="text-sm font-medium underline-offset-2 hover:underline"
                    >
                      {invoice.deal.title}
                    </DashboardLink>
                  </div>
                </div>
              ) : null}
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0 break-words">
                  <p className="text-sm">{invoice.customerEmail}</p>
                </div>
              </div>
              {invoice.customerPhone && (
                <div className="flex items-start gap-3">
                  <Phone className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm">{invoice.customerPhone}</p>
                  </div>
                </div>
              )}
              {invoice.customerAddress && (
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm whitespace-pre-line break-words">{invoice.customerAddress}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Line items</CardTitle>
            </CardHeader>
            <CardContent>
              {invoice.items.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No line items on this invoice.
                </p>
              ) : (
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[150px]">Item</TableHead>
                    <TableHead className="text-center">Qty</TableHead>
                    <TableHead className="text-right min-w-[100px]">Unit price</TableHead>
                    <TableHead className="text-right min-w-[100px]">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{item.name}</div>
                          {item.description && (
                            <div className="text-sm text-muted-foreground">{item.description}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center tabular-nums">{item.quantity}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(item.unitPrice, invoice.currency as never)}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatCurrency(item.amount, invoice.currency as never)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
              )}
            </CardContent>
          </Card>

          {(invoice.terms || invoice.notes) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Additional information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {invoice.terms && (
                  <div>
                    <p className="text-sm font-semibold mb-2">Payment terms</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">{invoice.terms}</p>
                  </div>
                )}
                {invoice.notes && (
                  <div>
                    <p className="text-sm font-semibold mb-2">Notes</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{invoice.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Your company</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="font-semibold">
                {invoice.user.profile?.companyName || invoice.user.name || 'Company details not set'}
              </p>
              {invoice.user.profile?.companyEmail && (
                <p className="text-sm text-muted-foreground">{invoice.user.profile.companyEmail}</p>
              )}
              {invoice.user.profile?.companyPhone && (
                <p className="text-sm text-muted-foreground">{invoice.user.profile.companyPhone}</p>
              )}
              {invoice.user.profile?.companyAddress && (
                <p className="text-sm text-muted-foreground">{invoice.user.profile.companyAddress}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payment summary</CardTitle>
              <CardDescription>
                {canRecordPayment
                  ? 'Record bank or cash payments when they clear.'
                  : 'Payment status for this invoice.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(invoice.subtotal, invoice.currency as never)}</span>
                </div>
                {invoice.taxRate > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tax ({invoice.taxRate}%)</span>
                    <span>{formatCurrency(invoice.taxAmount, invoice.currency as never)}</span>
                  </div>
                )}
                {invoice.discount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Discount</span>
                    <span className="text-green-600 dark:text-green-400">
                      -{formatCurrency(invoice.discount, invoice.currency as never)}
                    </span>
                  </div>
                )}
              </div>
              <Separator />
              <div className="flex justify-between font-semibold text-lg">
                <span>Total</span>
                <span>{formatCurrency(invoice.total, invoice.currency as never)}</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Amount paid</span>
                  <span className="text-green-600 dark:text-green-400">
                    {formatCurrency(invoice.amountPaid, invoice.currency as never)}
                  </span>
                </div>
                <div className="flex justify-between font-semibold text-lg">
                  <span>Amount due</span>
                  <span className={invoice.amountDue > 0 ? 'text-destructive' : ''}>
                    {formatCurrency(invoice.amountDue, invoice.currency as never)}
                  </span>
                </div>
              </div>
              {canRecordPayment && (
                <Button className="w-full" onClick={() => setPayOpen(true)}>
                  <Banknote className="mr-2 h-4 w-4" />
                  Record payment
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record payment</DialogTitle>
            <DialogDescription>
              Due: {formatCurrency(invoice.amountDue, invoice.currency as never)}. This updates the
              invoice balance for staff and the client portal.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="payment-amount">Amount</Label>
              <Input
                id="payment-amount"
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment-method">Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger id="payment-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BANK_TRANSFER">Bank transfer</SelectItem>
                  <SelectItem value="UPI">UPI</SelectItem>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="CHEQUE">Cheque</SelectItem>
                  <SelectItem value="CARD">Card</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment-note">Note (optional)</Label>
              <Textarea
                id="payment-note"
                rows={2}
                placeholder="Reference number, bank name…"
                value={paymentNote}
                onChange={(e) => setPaymentNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)} disabled={recording}>
              Cancel
            </Button>
            <Button onClick={() => void handleRecordPayment()} disabled={recording}>
              {recording ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {recording ? 'Saving…' : 'Save payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
