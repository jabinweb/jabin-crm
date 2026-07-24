'use client';

import { useState, useEffect } from 'react';
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
import { ArrowLeft, Download, Send, DollarSign, User, Mail, Phone, MapPin, Edit } from 'lucide-react';
import { formatCurrency } from '@/lib/currency';
import { toast } from 'sonner';
import { DashboardLink } from '@/components/navigation/dashboard-link';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { DetailSkeleton } from '@/components/loading';

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

  useEffect(() => {
    fetchInvoice();
  }, [params.id]);

  const fetchInvoice = async () => {
    try {
      const response = await fetch(`/api/invoices/${params.id}`);
      if (!response.ok) throw new Error('Failed to fetch invoice');
      const data = await response.json();
      setInvoice(data);
      if (data.amountDue > 0) {
        setPaymentAmount(String(data.amountDue));
      }
    } catch (error) {
      console.error('Error fetching invoice:', error);
      toast.error('Failed to load invoice');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
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
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Invoice downloaded successfully');
    } catch (error) {
      toast.error('Failed to download invoice');
      console.error(error);
    }
  };

  const handleSend = async () => {
    try {
      const response = await fetch(`/api/invoices/${params.id}/send`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to send invoice');

      toast.success('Invoice sent successfully');
      fetchInvoice();
    } catch (error) {
      toast.error('Failed to send invoice');
      console.error(error);
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
      PARTIAL: { variant: 'outline', label: 'Partial' },
      OVERDUE: { variant: 'destructive', label: 'Overdue' },
      CANCELLED: { variant: 'secondary', label: 'Cancelled' },
    };
    const config = statusConfig[status] || { variant: 'secondary' as const, label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading) {
    return <DetailSkeleton />;
  }

  if (!invoice) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold">Invoice not found</h2>
          <DashboardLink href="/dashboard/invoices">
            <Button className="mt-4">Back to Invoices</Button>
          </DashboardLink>
        </div>
      </div>
    );
  }

  const canRecordPayment =
    invoice.amountDue > 0 && !['PAID', 'CANCELLED', 'DRAFT', 'REFUNDED'].includes(invoice.status);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <DashboardLink href="/dashboard/invoices">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </DashboardLink>
          <div>
            <h1 className="text-3xl font-bold">Invoice {invoice.invoiceNumber}</h1>
            <p className="text-muted-foreground">{invoice.title}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push(path(`/dashboard/invoices/${params.id}/edit`))}
          >
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button variant="outline" onClick={handleDownload}>
            <Download className="mr-2 h-4 w-4" />
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
              <DollarSign className="mr-2 h-4 w-4" />
              Record payment
            </Button>
          )}
          {invoice.status === 'DRAFT' && (
            <Button onClick={handleSend}>
              <Send className="mr-2 h-4 w-4" />
              Send Invoice
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Invoice Details</CardTitle>
                {getStatusBadge(invoice.status)}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Invoice Number</p>
                  <p className="font-mono font-semibold">{invoice.invoiceNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Issue Date</p>
                  <p className="font-semibold">
                    {new Date(invoice.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Due Date</p>
                  <p className="font-semibold">
                    {new Date(invoice.dueDate).toLocaleDateString()}
                  </p>
                </div>
                {invoice.sentAt && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Sent On</p>
                    <p className="font-semibold">
                      {new Date(invoice.sentAt).toLocaleDateString()}
                    </p>
                  </div>
                )}
                {invoice.paidAt && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Paid On</p>
                    <p className="font-semibold">
                      {new Date(invoice.paidAt).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>

              {invoice.description && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Description</p>
                    <p>{invoice.description}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Customer Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-semibold">{invoice.customerName}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm">{invoice.customerEmail}</p>
                </div>
              </div>
              {invoice.customerPhone && (
                <div className="flex items-start gap-3">
                  <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm">{invoice.customerPhone}</p>
                  </div>
                </div>
              )}
              {invoice.customerAddress && (
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm">{invoice.customerAddress}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Line Items</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-center">Qty</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
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
                      <TableCell className="text-center">{item.quantity}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(item.unitPrice, invoice.currency as never)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(item.amount, invoice.currency as never)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {(invoice.terms || invoice.notes) && (
            <Card>
              <CardHeader>
                <CardTitle>Additional Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {invoice.terms && (
                  <div>
                    <p className="text-sm font-semibold mb-2">Payment Terms</p>
                    <p className="text-sm text-muted-foreground">{invoice.terms}</p>
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

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Company Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="font-semibold">
                {invoice.user.profile?.companyName || invoice.user.name || 'Your Company'}
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
              <CardTitle>Payment Summary</CardTitle>
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
                    <span className="text-red-600">
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
                  <span className="text-muted-foreground">Amount Paid</span>
                  <span className="text-green-600">
                    {formatCurrency(invoice.amountPaid, invoice.currency as never)}
                  </span>
                </div>
                <div className="flex justify-between font-semibold text-lg">
                  <span>Amount Due</span>
                  <span className={invoice.amountDue > 0 ? 'text-red-600' : ''}>
                    {formatCurrency(invoice.amountDue, invoice.currency as never)}
                  </span>
                </div>
              </div>
              {canRecordPayment && (
                <Button className="w-full" onClick={() => setPayOpen(true)}>
                  <DollarSign className="mr-2 h-4 w-4" />
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
                min="0.01"
                step="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
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
            <Button onClick={handleRecordPayment} disabled={recording}>
              {recording ? 'Saving…' : 'Save payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
