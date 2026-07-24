'use client';

import { Suspense } from 'react';
import { PortalTicketForm } from '@/components/portal/portal-ticket-form';
import { FormSkeleton, PageHeaderSkeleton } from '@/components/loading';
import { PortalFeatureGuard } from '@/components/portal/portal-feature-guard';

export default function NewCustomerTicketPage() {
  return (
    <PortalFeatureGuard
      feature="customerPortal"
      title="Requests not available"
      description="Submitting new requests is not enabled for your portal."
    >
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
    </PortalFeatureGuard>
  );
}
