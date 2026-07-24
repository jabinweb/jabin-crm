'use client';

import { Suspense } from 'react';
import { PortalTicketForm } from '@/components/portal/portal-ticket-form';
import { FormSkeleton, PageHeaderSkeleton } from '@/components/loading';

export default function NewCustomerTicketPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <PageHeaderSkeleton />
          <FormSkeleton fields={5} />
        </div>
      }
    >
      <PortalTicketForm />
    </Suspense>
  );
}
