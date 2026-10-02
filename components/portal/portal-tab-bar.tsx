'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, LayoutGrid, LifeBuoy, Receipt, Ticket } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/portal', label: 'Home', icon: LayoutDashboard },
  { href: '/portal/tickets', label: 'Tickets', icon: Ticket },
  { href: '/portal/invoices', label: 'Invoices', icon: Receipt },
  { href: '/portal/support', label: 'Support', icon: LifeBuoy },
] as const;

/** App-style bottom navigation for the client portal on phones and tablets. */
export function PortalTabBar({ onMore, moreOpen }: { onMore: () => void; moreOpen: boolean }) {
  const pathname = usePathname() ?? '';
  const isActive = (href: string) =>
    href === '/portal' ? pathname === '/portal' : pathname === href || pathname.startsWith(`${href}/`);
  const moreActive = moreOpen || !TABS.some((t) => isActive(t.href));

  return (
    <nav
      aria-label="Primary"
      className="lg:hidden shrink-0 border-t border-slate-100 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-xl items-stretch px-1">
        {TABS.map((tab) => {
          const active = !moreOpen && isActive(tab.href);
          const Icon = tab.icon;
          return (
            <li key={tab.href} className="flex-1 min-w-0">
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors active:bg-slate-100 dark:active:bg-slate-800',
                  active ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.25 : 1.75} />
                <span className="truncate">{tab.label}</span>
              </Link>
            </li>
          );
        })}
        <li className="flex-1 min-w-0">
          <button
            type="button"
            onClick={onMore}
            aria-expanded={moreOpen}
            className={cn(
              'flex h-14 w-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors active:bg-slate-100 dark:active:bg-slate-800',
              moreActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'
            )}
          >
            <LayoutGrid className="h-5 w-5" strokeWidth={moreActive ? 2.25 : 1.75} />
            <span>More</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
