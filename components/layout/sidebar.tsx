'use client';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
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
  FlaskConical,
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
  CreditCard as BillingIcon,
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
} from 'lucide-react';
import Link from 'next/link';
import { getClientBrandConfig } from '@/lib/branding';
import { usePathname, useSearchParams, useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { getCompanyUrl, resolveWorkspaceDashboardHref } from '@/lib/company-url';
import { useWorkspaceConfig } from '@/hooks/use-workspace-config';
import type { WorkspaceFeatureKey } from '@/lib/workspace-templates';

interface NavigationItem {
  name: string;
  href: string;
  icon: any;
  children?: NavigationItem[];
  roles?: string[];
  module?: string;
  workspaceFeature?: WorkspaceFeatureKey;
  /** When set, label is replaced by terminology key at render time */
  terminologyKey?: keyof import('@/lib/workspace-templates').WorkspaceTerminology;
}

const mainNav: NavigationItem[] = [
  { name: 'Admin Hub', href: '/dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'] },
  { name: 'Customer Portal', href: '/portal', icon: LayoutDashboard, roles: ['CUSTOMER', 'ADMIN', 'SUPER_ADMIN'], workspaceFeature: 'customerPortal' },
  { name: 'Field service', href: '/dashboard/technician', icon: Wrench, roles: ['TECHNICIAN', 'ADMIN', 'SUPER_ADMIN'], workspaceFeature: 'fieldService' },
];

const crmNav: NavigationItem[] = [
  { name: 'Customer Dash', href: '/dashboard/customers/analytics', icon: LayoutDashboard, roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'], workspaceFeature: 'customerAnalytics' },
  { name: 'Customers', href: '/dashboard/customers', icon: Users, roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'], workspaceFeature: 'customers', terminologyKey: 'customers' },
  { name: 'Product catalog', href: '/dashboard/products', icon: Package, roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'], workspaceFeature: 'inventory', module: 'INVENTORY' },
  { name: 'Assets & stock', href: '/dashboard/inventory', icon: Database, roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'], workspaceFeature: 'equipment', module: 'EQUIPMENT', terminologyKey: 'equipment' },
];

const salesNav: NavigationItem[] = [
  { name: 'Leads Pipeline', href: '/dashboard/leads', icon: Activity, module: 'LEADS' },
  { name: 'Quotations', href: '/dashboard/quotations', icon: FileCheck, module: 'QUOTATIONS' },
  { name: 'Invoices', href: '/dashboard/invoices', icon: Receipt, module: 'INVOICES' },
  { name: 'Deals', href: '/dashboard/deals', icon: CreditCard, module: 'DEALS' },
  { name: 'WhatsApp Hub', href: '/dashboard/whatsapp', icon: MessageCircle, module: 'WHATSAPP' },
  { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
  { name: 'Tasks', href: '/dashboard/tasks', icon: ClipboardList },
  { name: 'Team', href: '/dashboard/team', icon: Users },
  { name: 'Calendar', href: '/dashboard/calendar', icon: CalendarIcon },
  { name: 'Duplicates', href: '/dashboard/duplicates', icon: Copy },
];

const supportNav: NavigationItem[] = [
  { name: 'Support desk', href: '/dashboard/support', icon: LifeBuoy, roles: ['ADMIN', 'SUPPORT_MANAGER', 'TECHNICIAN', 'SALES', 'SUPER_ADMIN'], module: 'TICKETS' },
  { name: 'Omnichannel inbox', href: '/dashboard/support/inbox', icon: Inbox, roles: ['ADMIN', 'SUPPORT_MANAGER', 'TECHNICIAN', 'SUPER_ADMIN'], module: 'SUPPORT_INBOX' },
  { name: 'Support analytics', href: '/dashboard/support/analytics', icon: BarChart3, roles: ['ADMIN', 'SUPPORT_MANAGER', 'SUPER_ADMIN'], module: 'TICKETS' },
  { name: 'Automation rules', href: '/dashboard/support/automation', icon: Zap, roles: ['ADMIN', 'SUPPORT_MANAGER', 'SUPER_ADMIN'], module: 'TICKETS' },
  { name: 'SLA policies', href: '/dashboard/support/sla-policies', icon: Clock, roles: ['ADMIN', 'SUPPORT_MANAGER', 'SUPER_ADMIN'], module: 'SUPPORT_SLA' },
  { name: 'Ticket queue', href: '/dashboard/tickets', icon: List, roles: ['ADMIN', 'SUPPORT_MANAGER', 'TECHNICIAN', 'SALES', 'SUPER_ADMIN'], module: 'TICKETS' },
  { name: 'Knowledge base', href: '/dashboard/support/knowledge', icon: BookOpen, roles: ['ADMIN', 'SUPPORT_MANAGER', 'SUPER_ADMIN'], module: 'SUPPORT_KNOWLEDGE' },
  { name: 'Canned responses', href: '/dashboard/support/canned-responses', icon: MessageSquare, roles: ['ADMIN', 'SUPPORT_MANAGER', 'SUPER_ADMIN'], module: 'SUPPORT_CANNED' },
  { name: 'Agent groups', href: '/dashboard/support/groups', icon: Users, roles: ['ADMIN', 'SUPPORT_MANAGER', 'SUPER_ADMIN'], module: 'SUPPORT_GROUPS' },
  { name: 'My tickets', href: '/portal/tickets', icon: List, roles: ['CUSTOMER'] },
  { name: 'Service Reports', href: '/dashboard/service-reports', icon: FileCheck, roles: ['ADMIN', 'SUPPORT_MANAGER', 'TECHNICIAN', 'SUPER_ADMIN'], module: 'SERVICE_REPORTS', workspaceFeature: 'serviceHistory' },
  { name: 'Cash On Hand', href: '/dashboard/service/cash', icon: Wallet, roles: ['ADMIN', 'SUPPORT_MANAGER', 'TECHNICIAN', 'SUPER_ADMIN'], module: 'SERVICE_CASH', workspaceFeature: 'fieldService' },
  { name: 'Travel & Expense', href: '/dashboard/service/expenses', icon: Route, roles: ['ADMIN', 'SUPPORT_MANAGER', 'TECHNICIAN', 'SUPER_ADMIN'], module: 'SERVICE_EXPENSES', workspaceFeature: 'fieldService' },
  { name: 'GPS Tracking', href: '/dashboard/service/gps', icon: MapPin, roles: ['ADMIN', 'SUPPORT_MANAGER', 'TECHNICIAN', 'SUPER_ADMIN'], module: 'SERVICE_GPS', workspaceFeature: 'fieldService' },
];

const saasNav: NavigationItem[] = [
  { name: 'SaaS Dashboard', href: '/admin', icon: ShieldAlert, roles: ['SUPER_ADMIN'] },
  { name: 'User Management', href: '/admin/users', icon: Users, roles: ['SUPER_ADMIN'] },
  { name: 'Subscriptions', href: '/admin/subscriptions', icon: BillingIcon, roles: ['SUPER_ADMIN'] },
  { name: 'Platform Settings', href: '/admin/settings', icon: Settings, roles: ['SUPER_ADMIN'] },
];

const emailNav: NavigationItem[] = [
  {
    name: 'Communication',
    href: '/dashboard/emails',
    icon: Mail,
    module: 'EMAIL_OUTREACH',
    children: [
      { name: 'Sent Box', href: '/dashboard/emails?folder=sent', icon: Send },
      { name: 'Drafts', href: '/dashboard/emails?folder=drafts', icon: FileText },
      { name: 'Campaigns', href: '/dashboard/campaigns', icon: MailOpen },
      { name: 'Sequences', href: '/dashboard/sequences', icon: Activity },
      { name: 'Templates', href: '/dashboard/email-templates', icon: FileText },
    ]
  }
];

const settingsNav: NavigationItem[] = [
  { name: 'Reporting', href: '/dashboard/reports', icon: BarChart3 },
  { name: 'Documentation', href: '/dashboard/docs', icon: BookOpen },
  {
    name: 'Settings',
    href: '/dashboard/settings',
    icon: Settings,
    children: [
      { name: 'Account', href: '/dashboard/settings', icon: Settings },
      { name: 'Personal CRM', href: '/dashboard/settings/advanced', icon: User },
      { name: 'Calendar sync', href: '/dashboard/settings/calendar', icon: CalendarIcon },
      { name: 'Billing', href: '/dashboard/settings/subscription', icon: CreditCard },
    ]
  },
];

interface SidebarProps {
  onNavigate?: () => void;
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role || 'SALES';
  const params = useParams<{ company?: string }>();
  const companySlug =
    (typeof params?.company === 'string' ? params.company : undefined) ??
    (session?.user as { companySlug?: string } | undefined)?.companySlug?.trim();

  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [expandedMenus, setExpandedMenus] = useState<string[]>(['Communication']);
  const [moduleMap, setModuleMap] = useState<Record<string, boolean>>({});
  const { data: workspaceData } = useWorkspaceConfig();
  const workspaceFeatures = workspaceData?.config.features;
  const terminology = workspaceData?.config.terminology;

  const resolveHref = (href: string) =>
    resolveWorkspaceDashboardHref(href, companySlug, userRole);

  const workspaceAdminNav = useMemo((): NavigationItem[] => {
    if (!companySlug || userRole !== 'ADMIN') return [];
    return [
      { name: 'Workspace overview', href: getCompanyUrl('/admin', companySlug), icon: Building2, roles: ['ADMIN'] },
      { name: 'Approvals', href: getCompanyUrl('/admin/approvals', companySlug), icon: FileCheck, roles: ['ADMIN'] },
      { name: 'Workspace users', href: getCompanyUrl('/admin/users', companySlug), icon: Users, roles: ['ADMIN'] },
    ];
  }, [companySlug, userRole]);

  const hrNav = useMemo((): NavigationItem[] => {
    if (!companySlug || !['ADMIN', 'SUPER_ADMIN'].includes(userRole)) return [];
    return [
      { name: 'Employees', href: '/dashboard/employees', icon: Users, roles: ['ADMIN', 'SUPER_ADMIN'] },
      { name: 'Approve staff', href: '/dashboard/approve-employees', icon: FileCheck, roles: ['ADMIN', 'SUPER_ADMIN'] },
      { name: 'Payroll', href: '/dashboard/payroll', icon: Wallet, roles: ['ADMIN', 'SUPER_ADMIN'] },
      { name: 'Leave requests', href: '/dashboard/leave-requests', icon: CalendarIcon, roles: ['ADMIN', 'SUPER_ADMIN'] },
    ];
  }, [companySlug, userRole]);

  useEffect(() => {
    const loadModules = async () => {
      try {
        const res = await fetch('/api/features/me');
        if (!res.ok) return;
        const data = await res.json();
        setModuleMap(data.modules || {});
      } catch (_) {
        setModuleMap({});
      }
    };
    loadModules();
  }, []);

  const toggleMenu = (menuName: string) => {
    setExpandedMenus(prev =>
      prev.includes(menuName)
        ? prev.filter(name => name !== menuName)
        : [...prev, menuName]
    );
  };

  const isActive = (href: string) => {
    const resolved = resolveHref(href);
    const [hrefPath, hrefQuery] = resolved.split('?');
    const isDashboardHome =
      href === '/dashboard' || hrefPath === (companySlug ? `/${companySlug}/dashboard` : '/dashboard');
    if (hrefQuery) {
      if (pathname !== hrefPath) return false;
      const hrefParams = new URLSearchParams(hrefQuery);
      const hrefParamsArray = Array.from(hrefParams.entries());
      for (let i = 0; i < hrefParamsArray.length; i++) {
        const [key, value] = hrefParamsArray[i];
        if (searchParams.get(key) !== value) return false;
      }
      return true;
    }
    if (pathname === hrefPath) return true;
    if (!isDashboardHome && pathname.startsWith(`${hrefPath}/`)) return true;
    return false;
  };

  const isParentActive = (item: NavigationItem) => {
    if (item.children) {
      return item.children.some((child) => {
        const base = resolveHref(child.href).split('?')[0];
        return isActive(child.href) || pathname.startsWith(`${base}/`);
      });
    }
    return false;
  };

  const renderNavGroup = (items: NavigationItem[], title?: string) => {
    const filtered = items.filter(item => {
      const roleAllowed = !item.roles || item.roles.includes(userRole);
      const moduleAllowed = !item.module || moduleMap[item.module] === true;
      const workspaceAllowed =
        !item.workspaceFeature ||
        !workspaceFeatures ||
        workspaceFeatures[item.workspaceFeature] === true;
      return roleAllowed && moduleAllowed && workspaceAllowed;
    });
    if (filtered.length === 0) return null;

    const labelFor = (item: NavigationItem) => {
      if (item.terminologyKey && terminology?.[item.terminologyKey]) {
        return terminology[item.terminologyKey];
      }
      return item.name;
    };

    return (
      <div className="py-4">
        {title && <h3 className="mb-3 px-3 text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">{title}</h3>}
        <div className="space-y-1">
          {filtered.map((item) => (
            <div key={item.name}>
              {item.children ? (
                <>
                  <Button
                    variant={isParentActive(item) ? "secondary" : "ghost"}
                    className={cn(
                      "w-full justify-between h-9",
                      isParentActive(item) && "bg-muted/50 font-medium"
                    )}
                    onClick={() => toggleMenu(item.name)}
                  >
                    <div className="flex items-center">
                      <item.icon className={cn(
                        "mr-3 h-4 w-4",
                        isParentActive(item) ? "text-foreground" : "text-muted-foreground/70"
                      )} />
                      <span className="text-xs font-bold uppercase tracking-widest">{labelFor(item)}</span>
                    </div>
                    {expandedMenus.includes(item.name) ? (
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    ) : (
                      <ChevronRight className="h-4 w-4 opacity-50" />
                    )}
                  </Button>
                  {expandedMenus.includes(item.name) && (
                    <div className="ml-4 mt-1 space-y-1 border-l pl-2">
                      {item.children.map((child) => (
                        <Button
                          key={child.name}
                          variant={isActive(child.href) ? "secondary" : "ghost"}
                          className={cn(
                            "w-full justify-start text-[10px] h-8 rounded-none uppercase tracking-widest font-bold",
                            isActive(child.href) ? "bg-foreground text-background" : "text-muted-foreground/70 hover:text-foreground"
                          )}
                          asChild
                          onClick={onNavigate}
                        >
                          <Link href={resolveHref(child.href)}>
                            <child.icon className={cn(
                              "mr-2 h-3 w-3",
                              isActive(child.href) ? "text-background" : "text-muted-foreground/60"
                            )} />
                            {child.name}
                          </Link>
                        </Button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <Button
                  variant={isActive(item.href) ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start h-9 px-3 mb-1 transition-all rounded-none",
                    isActive(item.href)
                      ? "bg-foreground text-background font-black border-l-2 border-foreground"
                      : "text-muted-foreground/80 hover:text-foreground hover:bg-muted/50 border-l-2 border-transparent"
                  )}
                  asChild
                  onClick={onNavigate}
                >
                  <Link href={resolveHref(item.href)}>
                    <item.icon className={cn(
                      "mr-3 h-4 w-4",
                      isActive(item.href) ? "text-background" : "text-muted-foreground/70"
                    )} />
                    <span className="text-xs font-bold uppercase tracking-[0.15em]">{labelFor(item)}</span>
                  </Link>
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const brand = getClientBrandConfig();

  return (
    <div className="pb-12 w-64 border-r h-full bg-background transition-colors duration-200">
      <div className="space-y-4 py-8 px-4">
        <div className="px-2 border-b border-foreground/5 pb-8">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-foreground" />
            <h2 className="text-sm font-black uppercase tracking-[0.25em] text-foreground">
              {brand.appName}
            </h2>
          </div>
          <p className="text-[9px] font-bold text-muted-foreground mt-2 tracking-widest opacity-50 uppercase">
            Control Interface v2.4
          </p>
        </div>

        {renderNavGroup(mainNav, "Main")}
        {workspaceAdminNav.length > 0 && renderNavGroup(workspaceAdminNav, "Workspace admin")}
        {hrNav.length > 0 && renderNavGroup(hrNav, "HRMS")}
        {userRole === 'SUPER_ADMIN' && renderNavGroup(saasNav, "Platform admin")}
        {renderNavGroup(crmNav, "CRM Core")}
        {userRole !== 'TECHNICIAN' && renderNavGroup(salesNav, "Sales & Billing")}
        {renderNavGroup(supportNav, "Support")}
        {userRole !== 'TECHNICIAN' && userRole !== 'CUSTOMER' && renderNavGroup(emailNav, "Outreach")}
        {renderNavGroup(settingsNav, "System")}
      </div>
    </div>
  );
}
