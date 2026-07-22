'use client';

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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { getClientBrandConfig } from '@/lib/branding';

const NAV = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/admin/companies', label: 'Companies', icon: Building2 },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/subscriptions', label: 'Subscriptions', icon: CreditCard },
  { href: '/admin/plans', label: 'Plans', icon: FileText },
  { href: '/admin/emails', label: 'Email logs', icon: Mail },
  { href: '/admin/activity', label: 'Activity', icon: Activity },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
] as const;

type Props = {
  email?: string | null;
  name?: string | null;
  exitHref: string;
  children: React.ReactNode;
};

export function PlatformAdminShell({ email, name, exitHref, children }: Props) {
  const pathname = usePathname();
  const brand = getClientBrandConfig();
  const initial = (name || email || 'A').charAt(0).toUpperCase();

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <div className="fixed inset-0 flex overflow-hidden bg-background">
      <aside className="w-60 shrink-0 border-r bg-background flex flex-col">
        <div className="px-4 py-4 border-b">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-teal-700" />
            <p className="text-sm font-semibold tracking-tight truncate">{brand.appName}</p>
          </div>
          <p className="mt-1 text-[11px] font-medium text-muted-foreground">Platform admin</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground/80 truncate">{email}</p>
        </div>

        <nav className="flex-1 overflow-y-auto overscroll-contain px-2 py-3 space-y-0.5 [scrollbar-width:thin]">
          {NAV.map((item) => {
            const active = isActive(item.href, 'exact' in item ? item.exact : false);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2.5 rounded-md px-2.5 h-8 text-sm transition-colors',
                  active
                    ? 'bg-muted font-medium text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                )}
              >
                <item.icon
                  className={cn(
                    'h-4 w-4 shrink-0',
                    active ? 'text-teal-700' : 'text-muted-foreground'
                  )}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t p-2 space-y-0.5">
          <Button variant="ghost" size="sm" className="w-full justify-start h-8 px-2.5" asChild>
            <Link href={exitHref}>
              <ChevronLeft className="h-4 w-4 mr-2" />
              Exit admin
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start h-8 px-2.5 text-muted-foreground"
            onClick={() => signOut({ callbackUrl: '/' })}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign out
          </Button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col min-h-0">
        <header className="shrink-0 h-14 border-b px-6 flex items-center justify-between bg-background">
          <div>
            <p className="text-sm font-medium">Platform console</p>
            <p className="text-xs text-muted-foreground">Manage workspaces, billing, and access</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:block text-right mr-1">
              <p className="text-sm font-medium leading-none">{name || 'Admin'}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate max-w-[180px]">
                {email}
              </p>
            </div>
            <Avatar className="h-8 w-8 rounded-md">
              <AvatarFallback className="rounded-md bg-teal-700 text-white text-xs">
                {initial}
              </AvatarFallback>
            </Avatar>
          </div>
        </header>

        <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain bg-muted/20">
          <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
