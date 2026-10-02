import { Suspense } from 'react';
import { InvoiceForm } from '@/components/forms/invoice-form';
import { FormSkeleton } from '@/components/loading';

function NewInvoiceFallback() {
  return (
    <div className="space-y-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">New invoice</h1>
        <p className="text-sm text-muted-foreground">Bill a customer for products or services</p>
      </div>
      <FormSkeleton fields={6} />
    </div>
  );
}

export default function NewInvoicePage() {
  return (
    <Suspense fallback={<NewInvoiceFallback />}>
      <InvoiceForm mode="create" />
    </Suspense>
  );
}
