'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';

const CLIENT_TIMEOUT_MS = 8_000;
const INTERVAL_MS = 5 * 60_000;
const INITIAL_DELAY_MS = 20_000;
const COOLDOWN_KEY = 'email-reply-check-cooldown-until';

/**
 * Background email reply checker — must never starve other API routes.
 * Runs only on email dashboard paths, with a short client abort and long cooldown after failures.
 */
export function EmailReplyChecker() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isCheckingRef = useRef(false);

  useEffect(() => {
    if (!session?.user) return;
    if (!pathname?.includes('/dashboard/emails')) return;

    const checkReplies = async () => {
      if (isCheckingRef.current) return;
      const until = Number(sessionStorage.getItem(COOLDOWN_KEY) || 0);
      if (until && Date.now() < until) return;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);

      try {
        isCheckingRef.current = true;
        const response = await fetch('/api/emails/check-replies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ daysBack: 1 }),
          signal: controller.signal,
        });

        if (response.ok) return;

        if (response.status === 504 || response.status === 503) {
          sessionStorage.setItem(COOLDOWN_KEY, String(Date.now() + 15 * 60_000));
        }
      } catch {
        sessionStorage.setItem(COOLDOWN_KEY, String(Date.now() + 10 * 60_000));
      } finally {
        clearTimeout(timer);
        isCheckingRef.current = false;
      }
    };

    const initialTimeout = setTimeout(checkReplies, INITIAL_DELAY_MS);
    intervalRef.current = setInterval(checkReplies, INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      clearTimeout(initialTimeout);
    };
  }, [session?.user, pathname]);

  return null;
}
