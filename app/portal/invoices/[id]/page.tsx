'use client';

import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { ChevronLeft, Download, CreditCard, Building2 } from 'lucide-react';
import { formatCurrency } from '@/lib/currency';
import { SectionSkeleton } from '@/components/loading';
import { PortalFeatureGuard } from '@/components/portal/portal-feature-guard';

type InvoiceDetail = {
  id: string;
  invoiceNumber: string;
  title: string;
  status: string;
  currency: string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discount: number;
  total: number;
  amountPaid: number;
  amountDue: number;
  dueDate: string;
  notes?: string | null;
  terms?: string | null;
  paymentMethod?: string | null;
  paymentDetailsParsed?: Record<string, string> | null;
  items: Array<{
    id: string;
    name: string;
    description?: string | null;
    quantity: number;
    unitPrice: number;
    amount: number;
  }>;
  payments: Array<{
    id: string;
    amount: number;
    status?: string;
    description?: string | null;
    createdAt: string;
  }>;
};

function InvoiceDetailView() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const paySectionRef = useRef<HTMLDivElement>(null);

  const { data: invoice, isLoading, error } = useQuery({
    queryKey: ['portal-invoice', id],
    queryFn: async () => {
      const res = await fetch(`/api/portal/invoices/${id}`);
      if (!res.ok) throw new Error('Failed to load invoice');
      return res.json() as Promise<InvoiceDetail>;
    },
  });

  if (isLoading) {
    return <SectionSkeleton lines={8} className="py-4" />;
  }

  if (error || !invoice) {
    return (
      <div className="py-16 text-center space-y-4">
        <p className="text-muted-foreground">Invoice not found.</p>
        <Button variant="outline" asChild>
          <Link href="/portal/invoices">Back to invoices</Link>
        </Button>
      </div>
    );
  }

  const pay = invoice.paymentDetailsParsed;
  const hasBankDetails = !!(pay && Object.keys(pay).length > 0);
  const showPay =
    invoice.amountDue > 0 &&
    !['PAID', 'CANCELLED', 'REFUNDED'].includes(invoice.status);

  const scrollToPay = () => {
    paySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/portal/invoices')}
            className="rounded-none"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{invoice.invoiceNumber}</h1>
              <Badge variant="outline">{invoice.status}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{invoice.title}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {showPay && hasBankDetails ? (
            <Button type="button" onClick={scrollToPay}>
              <CreditCard className="mr-2 h-4 w-4" />
              How to pay
            </Button>
          ) : null}
          <Button variant="outline" asChild>
            <a href={`/api/portal/invoices/${invoice.id}/pdf`} target="_blank" rel="noreferrer">
              <Download className="mr-2 h-4 w-4" />
              Download PDF
            </a>
          </Button>
        </div>
      </div>

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
                {invoice.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="pl-6">
                      <div className="font-medium">{item.name}</div>
                      {item.description ? (
                        <div className="text-xs text-muted-foreground">{item.description}</div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(item.unitPrice, invoice.currency as never)}
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      {formatCurrency(item.amount, invoice.currency as never)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="space-y-2 border-t p-6 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(invoice.subtotal, invoice.currency as never)}</span>
              </div>
              {invoice.taxAmount > 0 ? (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax ({invoice.taxRate}%)</span>
                  <span>{formatCurrency(invoice.taxAmount, invoice.currency as never)}</span>
                </div>
              ) : null}
              {invoice.discount > 0 ? (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Discount</span>
                  <span>-{formatCurrency(invoice.discount, invoice.currency as never)}</span>
                </div>
              ) : null}
              <div className="flex justify-between font-semibold text-base pt-2">
                <span>Total</span>
                <span>{formatCurrency(invoice.total, invoice.currency as never)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Paid</span>
                <span>{formatCurrency(invoice.amountPaid, invoice.currency as never)}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Amount due</span>
                <span>{formatCurrency(invoice.amountDue, invoice.currency as never)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Due date</CardTitle>
              <CardDescription>{new Date(invoice.dueDate).toLocaleDateString()}</CardDescription>
            </CardHeader>
          </Card>

          {showPay ? (
            <div ref={paySectionRef} id="how-to-pay">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    How to pay
                  </CardTitle>
                  <CardDescription>
                    {hasBankDetails
                      ? 'Transfer the amount due using the bank details below. Your provider will mark the invoice paid once funds clear.'
                      : 'Online card payment is not available on this invoice.'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {invoice.paymentMethod ? (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Method</p>
                      <p className="font-medium">{invoice.paymentMethod}</p>
                    </div>
                  ) : null}
                  {hasBankDetails ? (
                    <>
                      {pay!.bankName ? (
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">Bank</p>
                          <p className="font-medium">{pay!.bankName}</p>
                        </div>
                      ) : null}
                      {pay!.accountName ? (
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">
                            Account name
                          </p>
                          <p className="font-medium">{pay!.accountName}</p>
                        </div>
                      ) : null}
                      {pay!.accountNumber ? (
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">
                            Account number
                          </p>
                          <p className="font-mono font-medium">{pay!.accountNumber}</p>
                        </div>
                      ) : null}
                      {pay!.iban ? (
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">IBAN</p>
                          <p className="font-mono font-medium">{pay!.iban}</p>
                        </div>
                      ) : null}
                      {pay!.routingNumber ? (
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">
                            Routing
                          </p>
                          <p className="font-mono font-medium">{pay!.routingNumber}</p>
                        </div>
                      ) : null}
                      {pay!.swiftCode ? (
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">SWIFT</p>
                          <p className="font-mono font-medium">{pay!.swiftCode}</p>
                        </div>
                      ) : null}
                      {pay!.paymentInstructions ? (
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">
                            Instructions
                          </p>
                          <p className="whitespace-pre-wrap">{pay!.paymentInstructions}</p>
                        </div>
                      ) : null}
                      <p className="text-xs text-muted-foreground pt-2">
                        Reference: {invoice.invoiceNumber}
                      </p>
                    </>
                  ) : (
                    <div className="rounded-md border bg-muted/40 p-3 space-y-2">
                      <p className="flex items-start gap-2 text-muted-foreground">
                        <Building2 className="h-4 w-4 mt-0.5 shrink-0" />
                        <span>
                          Payment details are not listed here. Contact your provider for bank
                          instructions, or check the PDF if one was attached.
                        </span>
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : null}

          {invoice.payments?.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Payment history</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {invoice.payments.map((p) => (
                  <div key={p.id} className="flex justify-between border-b pb-2 last:border-0">
                    <span className="text-muted-foreground">
                      {new Date(p.createdAt).toLocaleDateString()}
                      {p.status ? ` · ${p.status}` : ''}
                    </span>
                    <span className="font-medium">
                      {formatCurrency(p.amount, invoice.currency as never)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function PortalInvoiceDetailPage() {
  return (
    <PortalFeatureGuard
      feature="customerPortal"
      title="Invoices not available"
      description="Your provider has not enabled the customer portal for billing."
    >
      <InvoiceDetailView />
    </PortalFeatureGuard>
  );
}
