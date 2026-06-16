'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Download, X } from 'lucide-react';

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if running on iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(isIOSDevice);

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      return;
    }

    // Check if user dismissed the prompt before
    const dismissed = localStorage.getItem('pwa-prompt-dismissed');
    if (dismissed) {
      return;
    }

    // Listen for beforeinstallprompt event
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    }

    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-prompt-dismissed', 'true');
  };

  if (!showPrompt && !isIOS) {
    return null;
  }

  // iOS install instructions
  if (isIOS) {
    return (
      <Card className="fixed bottom-4 right-4 z-50 w-80 shadow-none">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Install App</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <CardDescription>
            Install LeadGen CRM on your iPhone for quick access
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm">
            1. Tap the Share button{' '}
            <span className="inline-block">
              <svg
                className="inline h-4 w-4"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M16 5l-1.42 1.42-1.59-1.59V16h-1.98V4.83L9.42 6.42 8 5l4-4 4 4zm4 5v11c0 1.1-.9 2-2 2H6c-1.11 0-2-.9-2-2V10c0-1.11.89-2 2-2h3v2H6v11h12V10h-3V8h3c1.1 0 2 .89 2 2z" />
              </svg>
            </span>
          </p>
          <p className="text-sm">2. Scroll down and tap "Add to Home Screen"</p>
          <p className="text-sm">3. Tap "Add" in the top right corner</p>
        </CardContent>
      </Card>
    );
  }

  // Chrome/Edge install prompt
  return (
    <Card className="fixed bottom-4 right-4 z-50 w-80 shadow-none">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Install App</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <CardDescription>
          Install LeadGen CRM for quick access and offline support
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={handleInstall} className="w-full">
          <Download className="h-4 w-4 mr-2" />
          Install Now
        </Button>
      </CardContent>
    </Card>
  );
}

