'use client';

import dynamic from 'next/dynamic';
import { useSession } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Navbar } from '@/components/layout/navbar';
import { Sidebar } from '@/components/layout/sidebar';
import { UsageBanner } from '@/components/subscription/usage-banner';
import { OnboardingRedirect } from '@/components/onboarding/onboarding-redirect';
import { Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ShellSkeleton } from '@/components/loading';
import { cn } from '@/lib/utils';
import '@/types/auth';

const EmailReplyChecker = dynamic(
  () => import('@/components/email/email-reply-checker').then((mod) => mod.EmailReplyChecker),
  { ssr: false }
);
const PWAInstallPrompt = dynamic(
  () => import('@/components/pwa/install-prompt').then((mod) => mod.PWAInstallPrompt),
  { ssr: false }
);
const OpsAgentPanel = dynamic(
  () => import('@/components/agent/ops-agent-panel').then((mod) => mod.OpsAgentPanel),
  { ssr: false }
);
const ServiceWorkerRegistration = dynamic(
  () =>
    import('@/components/pwa/service-worker-registration').then(
      (mod) => mod.ServiceWorkerRegistration
    ),
  { ssr: false }
);

function isFlushDashboardPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return (
    /\/dashboard\/messages(?:\/|$)/.test(pathname) ||
    /\/dashboard\/emails(?:\/|$)/.test(pathname)
  );
}

export function DashboardLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const flushContent = useMemo(() => isFlushDashboardPath(pathname), [pathname]);

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
    return <ShellSkeleton />;
  }

  if (!session?.user) {
    return null;
  }

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-background">
      <OnboardingRedirect />
      <ServiceWorkerRegistration />
      <PWAInstallPrompt />
      <div className="shrink-0">
        <Navbar />
        {pathname?.includes('/dashboard/emails') ? <EmailReplyChecker /> : null}
      </div>

      {/* Mobile Header */}
      <div className="lg:hidden shrink-0 z-40 bg-background border-b px-4 py-3 flex items-center gap-3">
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-[min(100vw,20.5rem)]" srOnlyTitle="Navigation menu">
            <Sidebar onNavigate={() => setSidebarOpen(false)} />
          </SheetContent>
        </Sheet>
        <h1 className="text-sm font-medium text-foreground">Menu</h1>
      </div>

      <div className="flex flex-1 min-h-0">
        <aside className="hidden lg:flex shrink-0 h-full min-h-0 overflow-hidden bg-background">
          <Sidebar />
        </aside>

        <main
          className={cn(
            'flex-1 min-w-0 h-full overscroll-contain bg-muted/20',
            flushContent ? 'overflow-hidden' : 'overflow-y-auto'
          )}
        >
          {flushContent ? (
            <div className="flex h-full min-h-0 flex-col">
              <div className="shrink-0 px-4 pt-3 sm:px-6 lg:px-8">
                <UsageBanner />
              </div>
              <div className="min-h-0 flex-1">{children}</div>
            </div>
          ) : (
            <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
              <UsageBanner />
              {children}
            </div>
          )}
        </main>
      </div>
      <OpsAgentPanel />
    </div>
  );
}
