import { Suspense } from 'react';
import { MessagingApp } from '@/components/messaging/messaging-app';

export default function EmployeeMessagesPage() {
  return (
    <div className="h-[calc(100dvh-8rem)] min-h-[480px] overflow-hidden rounded-lg border">
      <Suspense fallback={null}>
        <MessagingApp />
      </Suspense>
    </div>
  );
}
