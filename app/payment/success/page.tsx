import { Suspense } from 'react';
import PaymentSuccessPage from './page-client';

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">
          Loading…
        </div>
      }
    >
      <PaymentSuccessPage />
    </Suspense>
  );
}
