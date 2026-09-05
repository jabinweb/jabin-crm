'use client';

import { cn } from '@/lib/utils';
import { useSession } from 'next-auth/react';
import {
  Database,
  FileText,
  Settings,
  Users,
  BarChart3,
  Mail,
  ChevronDown,
  ChevronRight,
  Send,
  Copy,
  CreditCard,
  List,
  MailOpen,
  Star,
  Trash2,
  BookOpen,
  Receipt,
  FileCheck,
  LayoutDashboard,
  Wrench,
  Package,
  Activity,
  ShieldAlert,
  Building2,
  MessageCircle,
  Wallet,
  Route,
  MapPin,
  ClipboardList,
  Calendar as CalendarIcon,
  User,
  LifeBuoy,
  MessageSquare,
  Inbox,
  Clock,
  Zap,
  Truck,
  ShoppingCart,
  PiggyBank,
  FolderKanban,
  Landmark,
  LayoutGrid,
  RefreshCw,
  ArrowLeftRight,
  Briefcase,
  Globe,
  Gauge,
  HelpCircle,
  Plug,
  ListTodo,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { getClientBrandConfig } from '@/lib/branding';
import { OpslaneLogo } from '@/components/brand/opslane-logo';
import { usePathname, useSearchParams, useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { getCompanyUrl, resolveWorkspaceDashboardHref } from '@/lib/company-url';
import { useWorkspaceConfig } from '@/hooks/use-workspace-config';
import {
  fetchFeatureModules,
  didFeatureModulesFetchFail,
} from '@/components/feature-module-guard';
import { RecentEntitiesList } from '@/components/layout/recent-entities';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  type NavItem,
  type WorkspaceModuleId,
  getModuleDef,
  getAvailableModules,
  navItemsForModule,
  peopleNavSectionsForRole,
  resolveModuleId,
  resolveModuleSwitchHref,
  writeLastModule,
  HOME_WORK_NAV,
  MAIN_NAV,
} from '@/lib/navigation/modules';
import { useRouter } from 'next/navigation';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const ICON_STROKE = 1.75;

const ICON_MAP: Record<string, LucideIcon> = {
  Database,
  FileText,
  Settings,
  Users,
  BarChart3,
  Mail,
  Send,
  Copy,
  CreditCard,
  List,
  MailOpen,
  Star,
  Trash2,
  BookOpen,
  Receipt,
  FileCheck,
  LayoutDashboard,
  Wrench,
  Package,
  Activity,
  ShieldAlert,
  Building2,
  MessageCircle,
  Wallet,
  Route,
  MapPin,
  ClipboardList,
  Calendar: CalendarIcon,
  User,
  LifeBuoy,
  MessageSquare,
  Inbox,
  Clock,
  Zap,
  Truck,
  ShoppingCart,
  PiggyBank,
  FolderKanban,
  Landmark,
  LayoutGrid,
  ListTodo,
  RefreshCw,
  ArrowLeftRight,
  Briefcase,
  Globe,
  Gauge,
  Plug,
};

function resolveIcon(name: string): LucideIcon {
  return ICON_MAP[name] || LayoutDashboard;
}

interface SidebarProps {
  onNavigate?: () => void;
}

function NavSectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 mt-5 first:mt-0 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/65">
      {children}
    </p>
  );
}

function SidebarNavLink({
  href,
  icon: Icon,
  label,
  active,
  onClick,
  indent,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
  onClick?: () => void;
  indent?: boolean;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 rounded-lg py-2.5 text-sm transition-colors',
        indent ? 'pl-8 pr-3' : 'px-3',
        active
          ? 'bg-teal-600/10 font-medium text-teal-800'
          : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
      )}
    >
      <Icon
        className={cn('size-4 shrink-0', active ? 'text-teal-700' : 'text-muted-foreground')}
        strokeWidth={ICON_STROKE}
      />
      <span className="truncate">{label}</span>
    </Link>
  );
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const userRole = (session?.user as { role?: string } | undefined)?.role || 'SALES';
  const params = useParams<{ company?: string }>();
  const companySlug =
    (typeof params?.company === 'string' ? params.company : undefined) ??
    (session?.user as { companySlug?: string } | undefined)?.companySlug?.trim();

  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);
  const [moduleMap, setModuleMap] = useState<Record<string, boolean> | null>(null);
  const { data: workspaceData } = useWorkspaceConfig();
  const workspaceFeatures = workspaceData?.config.features;
  const terminology = workspaceData?.config.terminology;
  const vertical = workspaceData?.config.businessVertical ?? null;

  const resolveHref = (href: string) => {
    if (href.startsWith('/employee')) {
      return companySlug ? getCompanyUrl(href, companySlug) : href;
    }
    if (
      companySlug &&
      (href === '/admin' ||
        href.startsWith('/admin/approvals') ||
        href.startsWith('/admin/users'))
    ) {
      return getCompanyUrl(href === '/admin' ? '/admin' : href, companySlug);
    }
    if (href.startsWith('/admin')) {
      return href;
    }
    return resolveWorkspaceDashboardHref(href, companySlug, userRole);
  };

  const activeModuleId = useMemo(
    () => resolveModuleId(pathname, { vertical }),
    [pathname, vertical]
  );

  const availableModules = useMemo(
    () =>
      getAvailableModules({
        role: userRole,
        vertical,
        features: workspaceFeatures,
      }),
    [vertical, userRole, workspaceFeatures]
  );

  const { railModules, footerRailModule } = useMemo(() => {
    const workspace = availableModules.find((m) => m.id === 'workspace');
    const platform = availableModules.find((m) => m.id === 'platform');
    const main = availableModules.filter((m) => m.id !== 'workspace' && m.id !== 'platform');
    const footer = platform ?? workspace ?? null;
    return { railModules: main, footerRailModule: footer };
  }, [availableModules]);

  const moduleNavItems = useMemo((): NavItem[] => {
    if (activeModuleId === 'home') {
      let items = [
        ...MAIN_NAV.filter((i) => !i.roles || i.roles.includes(userRole)),
        ...HOME_WORK_NAV.filter((i) => !i.roles || i.roles.includes(userRole)),
      ];
      if (vertical === 'web_agency') {
        items = items.filter((i) => i.href !== '/dashboard/technician');
      }
      // Home is selected via the icon rail — avoid duplicating it in the list
      if (activeModuleId === 'home') {
        items = items.filter((i) => i.href !== '/dashboard');
      }
      return items;
    }

    let items = navItemsForModule(activeModuleId, {
      vertical,
      companySlug,
      userRole,
    });

    if (activeModuleId === 'workspace' && companySlug && ['ADMIN', 'SUPER_ADMIN'].includes(userRole)) {
      items = [
        {
          name: 'Workspace overview',
          href: '/admin',
          icon: 'Building2',
          roles: ['ADMIN', 'SUPER_ADMIN'],
        },
        {
          name: 'Approvals',
          href: '/admin/approvals',
          icon: 'FileCheck',
          roles: ['ADMIN', 'SUPER_ADMIN'],
        },
        {
          name: 'Workspace users',
          href: '/admin/users',
          icon: 'Users',
          roles: ['ADMIN', 'SUPER_ADMIN'],
        },
        ...items,
      ];
    }

    return items;
  }, [activeModuleId, vertical, companySlug, userRole]);

  useEffect(() => {
    if (!companySlug || !pathname) return;
    if (activeModuleId === 'home') return;
    writeLastModule(companySlug, {
      id: activeModuleId,
      lastHref: pathname,
    });
  }, [companySlug, pathname, activeModuleId]);

  useEffect(() => {
    let cancelled = false;
    fetchFeatureModules()
      .then((modules) => {
        if (cancelled) return;
        if (didFeatureModulesFetchFail()) {
          setModuleMap(null);
          return;
        }
        setModuleMap(modules);
      })
      .catch(() => {
        if (!cancelled) setModuleMap(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const toExpand: string[] = [];
    for (const item of moduleNavItems) {
      if (!item.children) continue;
      const childActive = item.children.some((child) => {
        const resolved = resolveHref(child.href);
        const [hrefPath] = resolved.split('?');
        return pathname === hrefPath || pathname.startsWith(`${hrefPath}/`);
      });
      if (childActive) toExpand.push(item.name);
    }
    if (toExpand.length) {
      setExpandedMenus((prev) => Array.from(new Set([...prev, ...toExpand])));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, activeModuleId]);

  const toggleMenu = (menuName: string) => {
    setExpandedMenus((prev) =>
      prev.includes(menuName)
        ? prev.filter((name) => name !== menuName)
        : [...prev, menuName]
    );
  };

  const isActive = (href: string) => {
    const resolved = resolveHref(href);
    const [hrefPath, hrefQuery] = resolved.split('?');
    const isDashboardHome =
      href === '/dashboard' ||
      hrefPath === (companySlug ? `/${companySlug}/dashboard` : '/dashboard');
    if (hrefQuery) {
      if (pathname !== hrefPath) return false;
      const hrefParams = new URLSearchParams(hrefQuery);
      for (const [key, value] of Array.from(hrefParams.entries())) {
        if (searchParams.get(key) !== value) return false;
      }
      return true;
    }
    if (pathname === hrefPath) return true;
    if (!isDashboardHome && pathname.startsWith(`${hrefPath}/`)) return true;
    return false;
  };

  const isParentActive = (item: NavItem) => {
    if (!item.children) return false;
    return item.children.some((child) => {
      const base = resolveHref(child.href).split('?')[0];
      return isActive(child.href) || pathname.startsWith(`${base}/`);
    });
  };

  const moduleAllowedFor = (item: NavItem) => {
    if (!item.module) return true;
    if (moduleMap === null) return true;
    if (moduleMap[item.module] === true) return true;
    if (
      item.waiveInventoryModuleWhenNoStock &&
      item.module === 'INVENTORY' &&
      workspaceFeatures?.inventory !== true &&
      workspaceFeatures?.products === true
    ) {
      return true;
    }
    return false;
  };

  const childVisible = (child: NavItem) => {
    const childRoleOk = !child.roles || child.roles.includes(userRole);
    const childModuleOk = moduleAllowedFor(child);
    const childWorkspaceOk =
      !child.workspaceFeature ||
      !workspaceFeatures ||
      workspaceFeatures[child.workspaceFeature] === true;
    return childRoleOk && childModuleOk && childWorkspaceOk;
  };

  const filterItems = (items: NavItem[]) =>
    items.filter((item) => {
      const roleAllowed = !item.roles || item.roles.includes(userRole);
      const moduleAllowed = moduleAllowedFor(item);
      const workspaceAllowed =
        !item.workspaceFeature ||
        !workspaceFeatures ||
        workspaceFeatures[item.workspaceFeature] === true;
      if (!roleAllowed || !moduleAllowed || !workspaceAllowed) return false;
      if (item.children?.length) return item.children.some(childVisible);
      return true;
    });

  const labelFor = (item: NavItem) => {
    if (item.terminologyKey && terminology?.[item.terminologyKey]) {
      return terminology[item.terminologyKey];
    }
    return item.name;
  };

  const renderNavGroup = (items: NavItem[], title?: string) => {
    const filtered = filterItems(items);
    if (filtered.length === 0) return null;

    return (
      <div className="py-2">
        {title ? <NavSectionTitle>{title}</NavSectionTitle> : null}
        <div className="space-y-1">
          {filtered.map((item) => {
            const Icon = resolveIcon(item.icon);
            return (
              <div key={`${item.name}-${item.href}`}>
                {item.children ? (
                  <>
                    <button
                      type="button"
                      onClick={() => toggleMenu(item.name)}
                      className={cn(
                        'flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-colors',
                        isParentActive(item)
                          ? 'bg-teal-600/10 font-medium text-teal-800'
                          : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                      )}
                    >
                      <span className="flex items-center gap-2.5">
                        <Icon
                          className={cn(
                            'size-4 shrink-0',
                            isParentActive(item) ? 'text-teal-700' : undefined
                          )}
                          strokeWidth={ICON_STROKE}
                        />
                        <span className="font-medium">{labelFor(item)}</span>
                      </span>
                      {expandedMenus.includes(item.name) ? (
                        <ChevronDown className="size-4 opacity-50" strokeWidth={ICON_STROKE} />
                      ) : (
                        <ChevronRight className="size-4 opacity-50" strokeWidth={ICON_STROKE} />
                      )}
                    </button>
                    {expandedMenus.includes(item.name) ? (
                      <div className="ml-2 mt-0.5 space-y-0.5 border-l border-border pl-2">
                        {item.children.filter(childVisible).map((child) => {
                          const ChildIcon = resolveIcon(child.icon);
                          return (
                            <SidebarNavLink
                              key={`${child.name}-${child.href}`}
                              href={resolveHref(child.href)}
                              icon={ChildIcon}
                              label={child.name}
                              active={isActive(child.href)}
                              onClick={onNavigate}
                              indent
                            />
                          );
                        })}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <SidebarNavLink
                    href={resolveHref(item.href)}
                    icon={Icon}
                    label={labelFor(item)}
                    active={isActive(item.href)}
                    onClick={onNavigate}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const brand = getClientBrandConfig();
  const activeDef = getModuleDef(activeModuleId);
  const homeDef = getModuleDef('home');
  const HomeIcon = resolveIcon(homeDef.icon);
  const ActiveIcon = resolveIcon(activeDef.icon);
  const peopleSections = peopleNavSectionsForRole(userRole);
  const showSettingsFooter = ['ADMIN', 'SUPER_ADMIN', 'SALES', 'SUPPORT_MANAGER'].includes(
    userRole
  );

  const switchModule = (id: string) => {
    const mod = availableModules.find((m) => m.id === id);
    if (!mod) return;
    const preferred = resolveModuleSwitchHref(mod.id, {
      vertical,
      companySlug: companySlug || '',
      landingHref: mod.href,
    });
    const pushTarget =
      companySlug && preferred.startsWith(`/${companySlug}/`)
        ? preferred
        : resolveHref(
            preferred.startsWith('/dashboard') ||
              preferred.startsWith('/admin') ||
              preferred.startsWith('/employee') ||
              preferred.startsWith('/portal')
              ? preferred
              : mod.href
          );
    router.push(pushTarget);
    onNavigate?.();
  };

  const switcherValue = activeModuleId === 'home' ? '__home__' : activeModuleId;

  const renderRailButton = (
    id: WorkspaceModuleId | 'home',
    label: string,
    Icon: LucideIcon,
    active: boolean,
    onClick: () => void
  ) => (
    <Tooltip key={id}>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-label={label}
          aria-current={active ? 'page' : undefined}
          className={cn(
            'flex size-11 items-center justify-center rounded-xl transition-all duration-150',
            active
              ? 'bg-teal-600 text-white shadow-sm shadow-teal-600/25'
              : 'text-muted-foreground hover:bg-background hover:text-foreground hover:shadow-sm'
          )}
        >
          <Icon className="size-5" strokeWidth={active ? 2 : ICON_STROKE} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={10}>
        {label}
      </TooltipContent>
    </Tooltip>
  );

  const homeMainItems = filterItems(
    MAIN_NAV.filter((i) => {
      if (i.href === '/dashboard') return false;
      if (vertical === 'web_agency' && i.href === '/dashboard/technician') return false;
      return true;
    })
  );
  const homeWorkItems = filterItems(HOME_WORK_NAV);

  return (
    <div className="flex h-full w-full border-r bg-background">
      <TooltipProvider delayDuration={200}>
        <div className="hidden md:flex w-[76px] shrink-0 flex-col border-r border-border/80 bg-muted/40 py-5 px-2.5">
          <div className="flex flex-col items-center">
            {renderRailButton('home', homeDef.label, HomeIcon, activeModuleId === 'home', () => {
              router.push(resolveHref('/dashboard'));
              onNavigate?.();
            })}
          </div>
          <div className="my-4 h-px w-8 self-center bg-border/80" />
          <div className="flex flex-1 flex-col items-center gap-2.5 overflow-y-auto overscroll-contain py-1 [scrollbar-width:none]">
            {railModules.map((m) => {
              const Icon = resolveIcon(m.icon);
              return renderRailButton(m.id, m.label, Icon, activeModuleId === m.id, () =>
                switchModule(m.id)
              );
            })}
          </div>
          {footerRailModule ? (
            <div className="mt-4 flex flex-col items-center gap-2.5 border-t border-border/80 pt-4">
              {renderRailButton(
                footerRailModule.id,
                footerRailModule.label,
                resolveIcon(footerRailModule.icon),
                activeModuleId === footerRailModule.id,
                () => switchModule(footerRailModule.id)
              )}
            </div>
          ) : null}
        </div>
      </TooltipProvider>

      <div className="flex w-[248px] min-w-[248px] flex-col">
        <div className="shrink-0 border-b border-border/80 px-4 py-4">
          <div className="flex items-center gap-3">
            <OpslaneLogo size={28} priority />
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-foreground">{brand.appName}</h2>
              <p className="truncate text-xs text-muted-foreground mt-0.5">
                {activeModuleId === 'home' ? 'Workspace' : activeDef.label}
              </p>
            </div>
          </div>

          {availableModules.length > 0 ? (
            <div className="mt-3 md:hidden">
              <Select
                value={switcherValue}
                onValueChange={(v) => {
                  if (v === '__home__') {
                    router.push(resolveHref('/dashboard'));
                    onNavigate?.();
                    return;
                  }
                  switchModule(v);
                }}
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue>
                    <span className="flex items-center gap-2 truncate">
                      {activeModuleId === 'home' ? (
                        <>
                          <HomeIcon className="size-3.5 shrink-0" strokeWidth={ICON_STROKE} />
                          {homeDef.label}
                        </>
                      ) : (
                        <>
                          <ActiveIcon className="size-3.5 shrink-0" strokeWidth={ICON_STROKE} />
                          {activeDef.label}
                        </>
                      )}
                    </span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__home__">
                    <span className="flex items-center gap-2">
                      <HomeIcon className="size-3.5" strokeWidth={ICON_STROKE} />
                      {homeDef.label}
                    </span>
                  </SelectItem>
                  {availableModules.map((m) => {
                    const Icon = resolveIcon(m.icon);
                    return (
                      <SelectItem key={m.id} value={m.id}>
                        <span className="flex items-center gap-2">
                          <Icon className="size-3.5" strokeWidth={ICON_STROKE} />
                          {m.label}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>

        <nav className="flex-1 overflow-y-auto overscroll-contain px-3 py-4 [scrollbar-width:thin]">
          {activeModuleId === 'home' ? (
            <>
              {homeMainItems.length > 0 ? renderNavGroup(homeMainItems, 'Quick links') : null}
              {homeWorkItems.length > 0 ? renderNavGroup(homeWorkItems, 'Work') : null}
              <div className="px-1 py-3 mt-2">
                <RecentEntitiesList compact />
              </div>
            </>
          ) : activeModuleId === 'people' && peopleSections.length > 0 ? (
            <>
              {peopleSections.map((section) =>
                renderNavGroup(section.items, section.title)
              )}
              <div className="px-1 py-3 mt-3 border-t border-border/80">
                <RecentEntitiesList compact />
              </div>
            </>
          ) : (
            <>
              {renderNavGroup(moduleNavItems)}
              <div className="px-1 py-3 mt-3 border-t border-border/80">
                <RecentEntitiesList compact />
              </div>
            </>
          )}
        </nav>

        <div className="shrink-0 border-t border-border/80 px-3 py-3 space-y-1">
          {showSettingsFooter ? (
            <SidebarNavLink
              href={resolveHref('/dashboard/settings')}
              icon={Settings}
              label="Settings"
              active={isActive('/dashboard/settings')}
              onClick={onNavigate}
            />
          ) : null}
          <SidebarNavLink
            href={resolveHref('/dashboard/docs')}
            icon={HelpCircle}
            label="Help & docs"
            active={isActive('/dashboard/docs')}
            onClick={onNavigate}
          />
        </div>
      </div>
    </div>
  );
}
