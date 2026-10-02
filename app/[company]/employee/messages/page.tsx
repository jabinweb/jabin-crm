import { Suspense } from 'react';
import { MessagingApp } from '@/components/messaging/messaging-app';

export default function EmployeeMessagesPage() {
  return (
    // Phones: bleed past the portal's main padding so the chat fills the space between the
    // app header and the bottom nav (composer sits right above the nav). Desktop: a framed panel
    // that fits the main area (top bar 4rem + main padding) without scrolling the page.
    <div className="-mx-4 -my-4 h-[calc(100dvh-7.5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] min-h-[420px] overflow-hidden border-y bg-background lg:m-0 lg:h-[calc(100dvh-10.5rem)] lg:min-h-[480px] lg:rounded-lg lg:border">
      <Suspense fallback={null}>
        <MessagingApp />
      </Suspense>
    </div>
  );
}
