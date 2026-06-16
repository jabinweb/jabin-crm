'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { LiveChatWidget } from '@/components/support/live-chat-widget';

function EmbedChatContent() {
  const searchParams = useSearchParams();
  const companyId = searchParams.get('companyId') ?? undefined;
  return <LiveChatWidget companyId={companyId} />;
}

/** Embeddable live chat page — iframe-friendly, no auth required. */
export default function EmbedChatPage() {
  return (
    <div className="min-h-screen bg-transparent">
      <Suspense fallback={null}>
        <EmbedChatContent />
      </Suspense>
    </div>
  );
}
