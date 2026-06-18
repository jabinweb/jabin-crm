'use client';

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import { InvoiceForm } from '@/components/forms/invoice-form';
import { Loader2 } from 'lucide-react';

export default function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  
  const { data: invoice, isLoading } = useQuery({
    queryKey: ['invoice', id],
    queryFn: async () => {
      const response = await fetch(`/api/invoices/${id}`);
      if (!response.ok) throw new Error('Failed to fetch invoice');
      return response.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="container mx-auto py-8">
        <p className="text-center text-muted-foreground">Invoice not found</p>
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
