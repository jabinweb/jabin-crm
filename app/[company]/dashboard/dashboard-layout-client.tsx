'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Navbar } from '@/components/layout/navbar';
import { Sidebar } from '@/components/layout/sidebar';
import { UsageBanner } from '@/components/subscription/usage-banner';
import { EmailReplyChecker } from '@/components/email/email-reply-checker';
import { PWAInstallPrompt } from '@/components/pwa/install-prompt';
import { OnboardingRedirect } from '@/components/onboarding/onboarding-redirect';
import { Loader2, Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import '@/types/auth';

export function DashboardLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }
    if (session?.user?.role === 'CUSTOMER') {
      router.replace('/portal');
    }
  }, [status, session, router]);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!session?.user) {
    return null;
  }

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-background">
      <OnboardingRedirect />
      <PWAInstallPrompt />
      <div className="shrink-0">
        <Navbar />
        <EmailReplyChecker />
      </div>

      {/* Mobile Header */}
      <div className="lg:hidden shrink-0 z-40 bg-background border-b px-4 py-3 flex items-center gap-3">
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64" srOnlyTitle="Navigation menu">
            <Sidebar onNavigate={() => setSidebarOpen(false)} />
          </SheetContent>
        </Sheet>
        <h1 className="text-sm font-medium text-foreground">Menu</h1>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Desktop Sidebar — own scroll only when nav is taller than viewport */}
        <aside className="hidden lg:flex shrink-0 h-full min-h-0 overflow-hidden bg-background">
          <Sidebar />
        </aside>

        {/* Main content — the only primary page scrollbar */}
        <main className="flex-1 min-w-0 h-full overflow-y-auto overscroll-contain bg-muted/20">
          <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <UsageBanner />
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
