'use client';

import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';

/**
 * Background email reply checker
 * Polls the check-replies endpoint every 30 seconds when user is active
 */
export function EmailReplyChecker() {
  const { data: session } = useSession();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isCheckingRef = useRef(false);

  useEffect(() => {
    if (!session?.user) return;

    const checkReplies = async () => {
      // Prevent concurrent checks
      if (isCheckingRef.current) return;
      
      try {
        isCheckingRef.current = true;
        
        const response = await fetch('/api/emails/check-replies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ daysBack: 1 }), // Only check last 24 hours
        });

        if (response.ok) {
          const result = await response.json();
          if (result.processed > 0) {
            console.log(`✅ Processed ${result.processed} email replies`);
          }
        } else {
          // Handle error responses properly
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          // Soft-fail timeouts / gateway errors — IMAP is slow on serverless
          if (response.status === 504 || response.status === 503 || errorData.timedOut) {
            if (!sessionStorage.getItem('imap-timeout-logged')) {
              console.log('ℹ️ Email reply check: timed out (will retry in background)');
              sessionStorage.setItem('imap-timeout-logged', 'true');
            }
          } else if (errorData.error === 'IMAP not configured') {
            if (!sessionStorage.getItem('imap-not-configured-logged')) {
              console.log(`ℹ️ Email reply check: ${errorData.message || 'IMAP not configured'}`);
              sessionStorage.setItem('imap-not-configured-logged', 'true');
            }
          } else if (!sessionStorage.getItem('email-checker-error-logged')) {
            console.log(`ℹ️ Email reply check: ${errorData.message || errorData.error || 'Check failed'}`);
            sessionStorage.setItem('email-checker-error-logged', 'true');
          }
        }
      } catch (error: any) {
        // Silently handle fetch errors - likely due to missing IMAP dependencies or route not available
        // Only log once to avoid console spam
        if (!sessionStorage.getItem('email-checker-error-logged')) {
          console.log('ℹ️ Email reply checker: Route unavailable (IMAP dependencies may not be installed)');
          sessionStorage.setItem('email-checker-error-logged', 'true');
        }
      } finally {
        isCheckingRef.current = false;
      }
    };

    // Delay initial check by 5 seconds to let app fully load
    const initialTimeout = setTimeout(checkReplies, 5000);

    // Then check every 60 seconds (reduced frequency)
    intervalRef.current = setInterval(checkReplies, 60000);

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      clearTimeout(initialTimeout);
    };
  }, [session]);

  // This component doesn't render anything
  return null;
}
