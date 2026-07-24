'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Download, Send, CheckCircle, XCircle, FileText, Mail, Edit } from 'lucide-react';
import { formatCurrency } from '@/lib/currency';
import { toast } from 'sonner';
import Link from 'next/link';
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
  DRAFT: "bg-gray-500",
  SENT: "bg-blue-500",
  VIEWED: "bg-purple-500",
  ACCEPTED: "bg-green-500",
  REJECTED: "bg-red-500",
  EXPIRED: "bg-orange-500",
  CONVERTED: "bg-teal-500",
};

export default function QuotationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { path } = useWorkspacePaths();
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchQuotation();
  }, [params.id]);

  const fetchQuotation = async () => {
    try {
      const response = await fetch(`/api/quotations/${params.id}`);
      if (!response.ok) throw new Error('Failed to fetch quotation');
      const data = await response.json();
      setQuotation(data);
    } catch (error) {
      console.error('Failed to fetch quotation:', error);
      toast.error('Failed to load quotation');
    } finally {
      setLoading(false);
    }
  };

  const handleSendQuotation = async () => {
    setSending(true);
    try {
      const response = await fetch(`/api/quotations/${params.id}/send`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to send quotation');
      toast.success('Quotation sent successfully');
      fetchQuotation();
    } catch (error) {
      console.error('Failed to send quotation:', error);
      toast.error('Failed to send quotation');
    } finally {
      setSending(false);
    }
  };

  const handleDownloadPDF = async () => {
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
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to download PDF:', error);
      toast.error('Failed to download PDF');
    }
  };

  if (loading) {
    return <DetailSkeleton />;
  }

  if (!quotation) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <FileText className="w-16 h-16 text-gray-400 mb-4" />
        <h2 className="text-2xl font-bold mb-2">Quotation not found</h2>
        <p className="text-gray-500 mb-4">The quotation you're looking for doesn't exist.</p>
        <Button onClick={() => router.push(path('/dashboard/quotations'))}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Quotations
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2 sm:gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push(path('/dashboard/quotations'))}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">{quotation.quotationNumber}</h1>
            <p className="text-sm md:text-base text-gray-500">{quotation.title}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {(quotation.status === 'DRAFT' || quotation.status === 'SENT') && (
            <Button variant="outline" onClick={() => router.push(path(`/dashboard/quotations/${params.id}/edit`))} className="flex-1 sm:flex-none">
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
          )}
          <Button variant="outline" onClick={handleDownloadPDF} className="flex-1 sm:flex-none">
            <Download className="w-4 h-4 mr-2" />
            Download
          </Button>
          {quotation.status === 'DRAFT' && (
            <Button onClick={handleSendQuotation} disabled={sending} className="flex-1 sm:flex-none">
              <Send className="w-4 h-4 mr-2" />
              {sending ? 'Sending...' : 'Send'}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="md:col-span-2 space-y-6">
          {/* Quotation Details */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Quotation Details</CardTitle>
                <Badge className={statusColors[quotation.status]}>
                  {quotation.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Customer</p>
                  <p className="font-medium">{quotation.customerName}</p>
                  <p className="text-sm text-gray-500">{quotation.customerEmail}</p>
                  {quotation.customerPhone && (
                    <p className="text-sm text-gray-500">{quotation.customerPhone}</p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-gray-500">Valid Until</p>
                  <p className="font-medium">
                    {new Date(quotation.validUntil).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {quotation.description && (
                <div>
                  <p className="text-sm text-gray-500">Description</p>
                  <p className="text-sm">{quotation.description}</p>
                </div>
              )}

              {quotation.customerAddress && (
                <div>
                  <p className="text-sm text-gray-500">Address</p>
                  <p className="text-sm whitespace-pre-line">{quotation.customerAddress}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Items */}
          <Card>
            <CardHeader>
              <CardTitle>Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[150px]">Item</TableHead>
                      <TableHead className="text-right min-w-[60px]">Qty</TableHead>
                      <TableHead className="text-right min-w-[100px]">Unit Price</TableHead>
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
                            <div className="text-sm text-gray-500">{item.description}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(item.unitPrice, quotation.currency as any)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(item.amount, quotation.currency as any)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>

              <Separator className="my-4" />

              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">
                    {formatCurrency(quotation.subtotal, quotation.currency as any)}
                  </span>
                </div>
                
                {quotation.taxRate > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tax ({quotation.taxRate}%)</span>
                    <span className="font-medium">
                      {formatCurrency(quotation.taxAmount, quotation.currency as any)}
                    </span>
                  </div>
                )}
                
                {quotation.discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount</span>
                    <span>-{formatCurrency(quotation.discount, quotation.currency as any)}</span>
                  </div>
                )}
                
                <Separator />
                
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>{formatCurrency(quotation.total, quotation.currency as any)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Terms and Notes */}
          {(quotation.terms || quotation.notes) && (
            <Card>
              <CardHeader>
                <CardTitle>Additional Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {quotation.terms && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-1">Terms & Conditions</p>
                    <p className="text-sm text-gray-600 whitespace-pre-line">{quotation.terms}</p>
                  </div>
                )}
                {quotation.notes && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-1">Notes</p>
                    <p className="text-sm text-gray-600 whitespace-pre-line">{quotation.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-gray-500">Created</p>
                <p className="text-sm font-medium">
                  {new Date(quotation.createdAt).toLocaleString()}
                </p>
              </div>
              
              {quotation.sentAt && (
                <div>
                  <p className="text-sm text-gray-500">Sent</p>
                  <p className="text-sm font-medium">
                    {new Date(quotation.sentAt).toLocaleString()}
                  </p>
                </div>
              )}
              
              {quotation.acceptedAt && (
                <div className="text-green-600">
                  <p className="text-sm">Accepted</p>
                  <p className="text-sm font-medium">
                    {new Date(quotation.acceptedAt).toLocaleString()}
                  </p>
                </div>
              )}
              
              {quotation.rejectedAt && (
                <div className="text-red-600">
                  <p className="text-sm">Rejected</p>
                  <p className="text-sm font-medium">
                    {new Date(quotation.rejectedAt).toLocaleString()}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Related Information */}
          {(quotation.lead || quotation.deal) && (
            <Card>
              <CardHeader>
                <CardTitle>Related</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {quotation.lead && (
                  <div>
                    <p className="text-sm text-gray-500">Lead</p>
                    <p className="text-sm font-medium">{quotation.lead.companyName}</p>
                  </div>
                )}
                {quotation.deal && (
                  <div>
                    <p className="text-sm text-gray-500">Deal</p>
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
