'use client';

import dynamic from 'next/dynamic';
import { useSession } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Navbar } from '@/components/layout/navbar';
import { Sidebar } from '@/components/layout/sidebar';
import { UsageBanner } from '@/components/subscription/usage-banner';
import { OnboardingRedirect } from '@/components/onboarding/onboarding-redirect';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { AppLoader } from '@/components/loading';
import { MobileTabBar } from '@/components/layout/mobile-tab-bar';
import { useWorkspaceConfig } from '@/hooks/use-workspace-config';
import { getModuleDef, resolveModuleId } from '@/lib/navigation/modules';
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
  const { data: workspaceData } = useWorkspaceConfig();
  const sectionTitle = useMemo(() => {
    const id = resolveModuleId(pathname ?? '', {
      vertical: workspaceData?.config.businessVertical ?? null,
    });
    if (id === 'home') return 'Home';
    // "Workspace" is a catch-all module (messages, calendar, settings…) — name the page instead
    if (id === 'workspace') {
      const segment = (pathname ?? '').split('/dashboard/')[1]?.split('/')[0];
      if (segment) {
        const words = segment.replace(/-/g, ' ');
        return words.charAt(0).toUpperCase() + words.slice(1);
      }
    }
    return getModuleDef(id).label;
  }, [pathname, workspaceData?.config.businessVertical]);

  // Close the menu after navigating (links inside it also close it, but back/forward don't)
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

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
    return <AppLoader />;
  }

  if (!session?.user) {
    return null;
  }

  // Portal customers are being sent to /portal — don't mount staff pages (and their API calls) meanwhile
  if (session.user.role === 'CUSTOMER') {
    return <AppLoader />;
  }

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-background">
      <OnboardingRedirect />
      <ServiceWorkerRegistration />
      <PWAInstallPrompt />
      <div className="shrink-0">
        <Navbar onMenu={() => setSidebarOpen(true)} title={sectionTitle} />
        {pathname?.includes('/dashboard/emails') ? <EmailReplyChecker /> : null}
      </div>

      {/* Phones and tablets: the full menu opens from the app bar or the More tab */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent
          side="left"
          className="p-0 w-[min(100vw,20.5rem)]"
          style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
          srOnlyTitle="Navigation menu"
        >
          <Sidebar onNavigate={() => setSidebarOpen(false)} />
        </SheetContent>
      </Sheet>

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
              <div className="shrink-0 px-4 pt-3 empty:hidden sm:px-6 lg:px-8">
                <UsageBanner />
              </div>
              <div className="min-h-0 flex-1">{children}</div>
            </div>
          ) : (
            <div className="mx-auto w-full max-w-7xl px-4 pb-8 pt-4 sm:px-6 sm:pt-6 lg:px-8">
              <UsageBanner />
              {children}
            </div>
          )}
        </main>
      </div>
      <MobileTabBar onMore={() => setSidebarOpen(true)} moreOpen={sidebarOpen} />
      <OpsAgentPanel />
    </div>
  );
}
