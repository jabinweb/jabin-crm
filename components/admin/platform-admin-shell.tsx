'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Mail,
  Settings,
  Activity,
  FileText,
  ChevronLeft,
  Building2,
  LogOut,
  Menu,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/ui/user-avatar';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { getClientBrandConfig } from '@/lib/branding';
import { OpslaneLogo } from '@/components/brand/opslane-logo';

const NAV = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/admin/companies', label: 'Companies', icon: Building2 },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/subscriptions', label: 'Subscriptions', icon: CreditCard },
  { href: '/admin/plans', label: 'Plans', icon: FileText },
  { href: '/admin/emails', label: 'Email logs', icon: Mail },
  { href: '/admin/activity', label: 'Activity', icon: Activity },
  { href: '/admin/files', label: 'Files', icon: FileText },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
] as const;

type Props = {
  email?: string | null;
  name?: string | null;
  exitHref: string;
  children: React.ReactNode;
};

function AdminSidebarContent({
  email,
  exitHref,
  isActive,
  onNavigate,
  touch = false,
}: {
  email?: string | null;
  exitHref: string;
  isActive: (href: string, exact?: boolean) => boolean;
  onNavigate?: () => void;
  touch?: boolean;
}) {
  const brand = getClientBrandConfig();
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="px-4 py-4 border-b">
        <div className={cn('flex items-center gap-2.5 min-w-0', touch && 'pr-8')}>
          <OpslaneLogo size={28} priority />
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-tight truncate">{brand.appName}</p>
            <p className="text-[11px] font-medium text-muted-foreground">Platform admin</p>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground/80 truncate">{email}</p>
      </div>

      <nav className="flex-1 overflow-y-auto overscroll-contain px-2 py-3 space-y-0.5 [scrollbar-width:thin]">
        {NAV.map((item) => {
          const active = isActive(item.href, 'exact' in item ? item.exact : false);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors',
                touch ? 'h-10' : 'h-8',
                active
                  ? 'bg-muted font-medium text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              )}
            >
              <item.icon
                className={cn('h-4 w-4 shrink-0', active ? 'text-teal-700' : 'text-muted-foreground')}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-2 space-y-0.5">
        <Button
          variant="ghost"
          size="sm"
          className={cn('w-full justify-start px-2.5', touch ? 'h-10' : 'h-8')}
          asChild
        >
          <Link href={exitHref} onClick={onNavigate}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            Exit admin
          </Link>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={cn('w-full justify-start px-2.5 text-muted-foreground', touch ? 'h-10' : 'h-8')}
          onClick={() => signOut({ callbackUrl: '/' })}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sign out
        </Button>
      </div>
    </div>
  );
}

export function PlatformAdminShell({ email, name, exitHref, children }: Props) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the mobile menu after navigating (including back/forward)
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const currentLabel =
    NAV.find((item) => isActive(item.href, 'exact' in item ? item.exact : false))?.label ??
    'Platform console';

  return (
    <div className="fixed inset-0 flex h-[100dvh] overflow-hidden bg-background">
      <aside className="hidden lg:flex w-60 shrink-0 border-r bg-background flex-col">
        <AdminSidebarContent email={email} exitHref={exitHref} isActive={isActive} />
      </aside>

      {/* Phones and tablets: the admin menu opens in a sheet */}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent
          side="left"
          className="p-0 w-[min(100vw,20.5rem)]"
          style={{
            paddingTop: 'env(safe-area-inset-top)',
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
          srOnlyTitle="Admin navigation"
        >
          <AdminSidebarContent
            email={email}
            exitHref={exitHref}
            isActive={isActive}
            onNavigate={() => setMenuOpen(false)}
            touch
          />
        </SheetContent>
      </Sheet>

      <div className="flex-1 min-w-0 flex flex-col min-h-0">
        <header
          className="shrink-0 border-b bg-background"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          <div className="h-14 pl-2 pr-4 sm:pl-4 sm:pr-6 lg:px-8 flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 shrink-0 lg:hidden"
                onClick={() => setMenuOpen(true)}
                aria-label="Open admin menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">
                  <span className="lg:hidden">{currentLabel}</span>
                  <span className="hidden lg:inline">Platform console</span>
                </p>
                <p className="hidden lg:block text-xs text-muted-foreground">
                  Manage workspaces, billing, and access
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <div className="hidden sm:block text-right mr-1">
                <p className="text-sm font-medium leading-none">{name || 'Admin'}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate max-w-[180px]">
                  {email}
                </p>
              </div>
              <UserAvatar person={{ name, email }} size="md" />
            </div>
          </div>
        </header>

        <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain bg-muted/20">
          <div className="mx-auto w-full max-w-7xl px-4 pt-4 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-6 sm:pt-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
