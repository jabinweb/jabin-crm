import { Suspense } from 'react';
import { MessagingApp } from '@/components/messaging/messaging-app';

export default function MessagesPage() {
  return (
    <div className="h-full min-h-0">
      <Suspense fallback={null}>
        <MessagingApp />
      </Suspense>
    </div>
  );
}
