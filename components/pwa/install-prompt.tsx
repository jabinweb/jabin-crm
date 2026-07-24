'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';
import { getClientBrandConfig } from '@/lib/branding';

const DISMISS_KEY = 'pwa-prompt-dismissed-at';
const DISMISS_DAYS = 30;
const SHOW_DELAY_MS = 60_000;

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function wasDismissedRecently(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    // Legacy boolean dismiss
    if (raw === 'true') return true;
    const at = Number(raw);
    if (!Number.isFinite(at)) return false;
    return Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function markDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    localStorage.removeItem('pwa-prompt-dismissed');
  } catch {
    /* ignore */
  }
}

/**
 * Soft PWA install hint — delayed, dismissible, never blocks primary UI (OPS FAB).
 */
export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const brand = getClientBrandConfig();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    if (wasDismissedRecently()) return;

    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(ios);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);

    const timer = window.setTimeout(() => {
      // Chrome/Edge: only after browser offered install
      // iOS: optional tip (no beforeinstallprompt)
      setVisible(true);
    }, SHOW_DELAY_MS);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.clearTimeout(timer);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setVisible(false);
    markDismissed();
  };

  const handleDismiss = () => {
    setVisible(false);
    markDismissed();
  };

  // Never show until delay elapsed; Chrome needs deferredPrompt; iOS is tip-only
  if (!visible) return null;
  if (!isIOS && !deferredPrompt) return null;

  return (
    <div
      className="fixed bottom-6 left-4 z-40 w-[min(20rem,calc(100vw-5.5rem))] rounded-lg border bg-background p-3 shadow-md sm:left-6"
      role="dialog"
      aria-label={`Install ${brand.appName}`}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-medium leading-none">Install {brand.appName}</p>
          <p className="text-xs text-muted-foreground">
            {isIOS
              ? 'Share → Add to Home Screen for quick access.'
              : 'Add to your home screen for faster access.'}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={handleDismiss}
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      {!isIOS && (
        <Button type="button" size="sm" className="mt-2 w-full" onClick={handleInstall}>
          <Download className="mr-1.5 h-3.5 w-3.5" />
          Install
        </Button>
      )}
    </div>
  );
}
