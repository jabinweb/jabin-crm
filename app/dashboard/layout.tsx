'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Navbar } from '@/components/layout/navbar';
import { Sidebar } from '@/components/layout/sidebar';
import { UsageBanner } from '@/components/subscription/usage-banner';
import { EmailReplyChecker } from '@/components/email/email-reply-checker';
import { PWAInstallPrompt } from '@/components/pwa/install-prompt';
import { ServiceWorkerRegistration } from '@/components/pwa/service-worker-registration';
import { Loader2 } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (status === 'loading') return;

    if (!session) {
      router.push('/auth/signin');
      return;
    }

    if (session.user.role === 'CUSTOMER') {
      router.push('/portal');
    }
  }, [session, status, router]);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen">
      <ServiceWorkerRegistration />
      <PWAInstallPrompt />
      <Navbar />
      <EmailReplyChecker />

      {/* Mobile Header with Menu Button */}
      <div className="lg:hidden sticky top-14 z-40 bg-background border-b px-4 py-3 flex items-center gap-3">
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64">
            <Sidebar onNavigate={() => setSidebarOpen(false)} />
          </SheetContent>
        </Sheet>
        <h1 className="text-lg font-semibold">Dashboard</h1>
      </div>

      <div className="flex min-h-[calc(100vh-3.5rem)] lg:h-[calc(100vh-3.5rem)]">
        {/* Desktop Sidebar - Hidden on Mobile */}
        <aside className="hidden lg:block sticky top-0 h-full overflow-y-auto border-r bg-background">
          <Sidebar />
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 w-full">
          <UsageBanner />
          {children}
        </main>
      </div>
    </div>
  );
}