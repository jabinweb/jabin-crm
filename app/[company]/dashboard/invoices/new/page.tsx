import { Suspense } from 'react';
import { InvoiceForm } from '@/components/forms/invoice-form';
import { SectionSkeleton } from '@/components/loading';

export default function NewInvoicePage() {
  return (
    <Suspense fallback={<SectionSkeleton lines={10} className="py-8" />}>
      <InvoiceForm mode="create" />
    </Suspense>
  );
}
