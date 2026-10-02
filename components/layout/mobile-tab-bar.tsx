'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  Activity,
  Briefcase,
  FolderKanban,
  Gauge,
  LayoutGrid,
  LifeBuoy,
  Mail,
  Package,
  Settings,
  ShieldAlert,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkspaceConfig } from '@/hooks/use-workspace-config';
import { getCompanyUrl, resolveWorkspaceDashboardHref } from '@/lib/company-url';
import {
  getAvailableModules,
  getModuleDef,
  resolveModuleId,
  resolveModuleSwitchHref,
  type WorkspaceModuleId,
} from '@/lib/navigation/modules';

const MODULE_ICONS: Record<string, LucideIcon> = {
  Gauge,
  FolderKanban,
  Activity,
  Users,
  LifeBuoy,
  Mail,
  Briefcase,
  Package,
  Settings,
  ShieldAlert,
};

/** Tabs besides Home and More — the workspace's first modules, in sidebar order. */
const MODULE_TABS = 3;

/**
 * App-style bottom navigation for the workspace dashboard on phones and tablets.
 * Mirrors the sidebar's module rail: Home, the top modules for this workspace, and
 * More (the full menu). Switching module returns to the last page used in it.
 */
export function MobileTabBar({ onMore, moreOpen }: { onMore: () => void; moreOpen: boolean }) {
  const { data: session } = useSession();
  const pathname = usePathname() ?? '';
  const params = useParams<{ company?: string }>();
  const companySlug =
    (typeof params?.company === 'string' ? params.company : undefined) ??
    session?.user?.companySlug?.trim() ??
    '';
  const role = session?.user?.role || 'SALES';
  const { data: workspaceData } = useWorkspaceConfig();
  const vertical = workspaceData?.config.businessVertical ?? null;
  const features = workspaceData?.config.features;

  const activeModuleId = resolveModuleId(pathname, { vertical });

  const tabs = useMemo(() => {
    const modules = getAvailableModules({ role, vertical, features }).filter(
      (m) => m.id !== 'home' && m.id !== 'workspace' && m.id !== 'platform'
    );
    const shown = modules.slice(0, MODULE_TABS);
    // The module you're in always gets a tab (it takes the last module slot)
    const current = modules.find((m) => m.id === activeModuleId);
    if (current && !shown.some((m) => m.id === current.id)) {
      if (shown.length < MODULE_TABS) shown.push(current);
      else shown[shown.length - 1] = current;
    }
    return [getModuleDef('home'), ...shown];
  }, [role, vertical, features, activeModuleId]);

  const hrefFor = (id: WorkspaceModuleId, landingHref: string) => {
    if (id === 'home') return resolveWorkspaceDashboardHref('/dashboard', companySlug, role);
    const preferred = resolveModuleSwitchHref(id, { vertical, companySlug, landingHref });
    if (companySlug && preferred.startsWith(`/${companySlug}/`)) return preferred;
    if (preferred.startsWith('/employee')) return companySlug ? getCompanyUrl(preferred, companySlug) : preferred;
    return resolveWorkspaceDashboardHref(
      preferred.startsWith('/dashboard') ? preferred : landingHref,
      companySlug,
      role
    );
  };

  const moreActive = moreOpen || !tabs.some((t) => t.id === activeModuleId);

  return (
    <nav
      aria-label="Primary"
      className="lg:hidden shrink-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-xl items-stretch px-1">
        {tabs.map((tab) => {
          const Icon = MODULE_ICONS[tab.icon] ?? LayoutGrid;
          const active = !moreOpen && activeModuleId === tab.id;
          return (
            <li key={tab.id} className="flex-1 min-w-0">
              <Link
                href={hrefFor(tab.id, tab.href)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-14 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-medium transition-colors active:bg-muted',
                  active ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.25 : 1.75} />
                <span className="max-w-full truncate px-1">{tab.id === 'home' ? 'Home' : tab.label}</span>
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
              'flex h-14 w-full flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-medium transition-colors active:bg-muted',
              moreActive ? 'text-primary' : 'text-muted-foreground'
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
