'use client';

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import { InvoiceForm } from '@/components/forms/invoice-form';
import { FormSkeleton } from '@/components/loading';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { DashboardLink } from '@/components/navigation/dashboard-link';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { AlertCircle, ArrowLeft } from 'lucide-react';

export default function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { path } = useWorkspacePaths();

  const { data: invoice, isLoading, error, refetch } = useQuery({
    queryKey: ['invoice', id],
    queryFn: async () => {
      const response = await fetch(`/api/invoices/${id}`);
      if (response.status === 404) throw new Error('NOT_FOUND');
      if (!response.ok) throw new Error('Failed to fetch invoice');
      return response.json();
    },
    retry: (count, err) => (err as Error).message !== 'NOT_FOUND' && count < 2,
  });

  const header = (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">Edit invoice</h1>
        <p className="text-sm text-muted-foreground">Update invoice details</p>
      </div>
      <DashboardLink href={`/dashboard/invoices/${id}`}>
        <Button variant="outline" size="sm" className="w-full sm:w-auto">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to invoice
        </Button>
      </DashboardLink>
    </div>
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        {header}
        <FormSkeleton fields={6} />
      </div>
    );
  }

  if (!invoice) {
    const notFound = !error || (error as Error).message === 'NOT_FOUND';
    return (
      <div className="space-y-6">
        {header}
        <Card>
          <EmptyState
            icon={AlertCircle}
            title={notFound ? 'Invoice not found' : "Couldn't load this invoice"}
            description={
              notFound
                ? 'It may have been deleted, or you may not have access to it.'
                : 'Check your connection and try again.'
            }
            actionLabel={notFound ? 'Back to invoices' : 'Retry'}
            {...(notFound
              ? { actionHref: path('/dashboard/invoices') }
              : { onAction: () => void refetch() })}
          />
        </Card>
      </div>
    );
  }

  // Parse payment details from JSON if available
  let paymentDetails = {};
  try {
    if (invoice.paymentDetails && typeof invoice.paymentDetails === 'string') {
      paymentDetails = JSON.parse(invoice.paymentDetails);
    } else if (invoice.paymentDetails && typeof invoice.paymentDetails === 'object') {
      paymentDetails = invoice.paymentDetails;
    }
  } catch (e) {
    console.error('Failed to parse payment details:', e);
  }

  const initialData = {
    title: invoice.title || '',
    description: invoice.description || '',
    customerName: invoice.customerName || '',
    customerEmail: invoice.customerEmail || '',
    customerPhone: invoice.customerPhone || '',
    customerAddress: invoice.customerAddress || '',
    dueDate: invoice.dueDate ? new Date(invoice.dueDate).toISOString().split('T')[0] : '',
    taxRate: invoice.taxRate || 0,
    discountRate: invoice.discount && invoice.subtotal ? Math.round((invoice.discount / invoice.subtotal) * 100 * 100) / 100 : 0,
    currency: invoice.currency || 'USD',
    terms: invoice.terms || '',
    notes: invoice.notes || '',
    // Preserve GST fields (otherwise the form submits blanks and wipes them)
    gstin: invoice.gstin || '',
    placeOfSupply: invoice.placeOfSupply || '',
    gstTaxType: (invoice.taxBreakup?.igst > 0
      ? 'IGST'
      : invoice.taxBreakup?.cgst > 0 || invoice.taxBreakup?.sgst > 0
        ? 'CGST_SGST'
        : '') as '' | 'CGST_SGST' | 'IGST',
    bankName: (paymentDetails as any).bankName || '',
    accountName: (paymentDetails as any).accountName || '',
    accountNumber: (paymentDetails as any).accountNumber || '',
    routingNumber: (paymentDetails as any).routingNumber || '',
    swiftCode: (paymentDetails as any).swiftCode || '',
    iban: (paymentDetails as any).iban || '',
    paymentInstructions: (paymentDetails as any).paymentInstructions || '',
  };

  const initialItems = invoice.items || [];

  return (
    <InvoiceForm
      mode="edit"
      invoiceId={id}
      initialData={initialData}
      initialItems={initialItems}
    />
  );
}
