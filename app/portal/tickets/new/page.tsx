'use client';

import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { PortalTicketForm } from '@/components/portal/portal-ticket-form';

export default function NewCustomerTicketPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin opacity-30" />
        </div>
      }
    >
      <PortalTicketForm />
    </Suspense>
  );
}
