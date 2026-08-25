'use client';

import { Suspense } from 'react';
import { PortalTicketForm } from '@/components/portal/portal-ticket-form';
import { FormSkeleton } from '@/components/loading';
import { PortalFeatureGuard } from '@/components/portal/portal-feature-guard';

export default function NewCustomerTicketPage() {
  return (
    <Suspense fallback={<FormSkeleton fields={5} withHeader />}>
      <PortalFeatureGuard
        feature="customerPortal"
        title="Requests not available"
        description="Submitting new requests is not enabled for your portal."
      >
        <PortalTicketForm />
      </PortalFeatureGuard>
    </Suspense>
  );
}
