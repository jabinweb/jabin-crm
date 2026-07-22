'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';

/** Persistent conversion bar on small screens only. */
export function StickyMobileCta() {
  return (
    <div className="fixed bottom-0 inset-x-0 z-40 border-t border-[var(--lp-line)] bg-white/95 backdrop-blur-md p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
      <div className="flex gap-2 max-w-lg mx-auto">
        <Button asChild variant="outline" className="flex-1 h-10 border-slate-300">
          <Link href="/pricing">Pricing</Link>
        </Button>
        <Button asChild className="flex-1 h-10 bg-[var(--lp-accent)] hover:bg-[var(--lp-accent-deep)] text-white">
          <Link href="/start">Start free</Link>
        </Button>
      </div>
    </div>
  );
}
