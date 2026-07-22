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
  Truck,
  ShoppingCart,
  PiggyBank,
  FolderKanban,
  Landmark,
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
  { name: 'Home', href: '/dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'] },
  { name: 'Client portal', href: '/portal', icon: LayoutDashboard, roles: ['CUSTOMER', 'ADMIN', 'SUPER_ADMIN'], workspaceFeature: 'customerPortal' },
  { name: 'My field work', href: '/dashboard/technician', icon: Wrench, roles: ['TECHNICIAN', 'ADMIN', 'SUPER_ADMIN'], workspaceFeature: 'fieldService' },
];

const crmNav: NavigationItem[] = [
  { name: 'Clients', href: '/dashboard/customers', icon: Users, roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'], workspaceFeature: 'customers', terminologyKey: 'customers' },
  { name: 'Products', href: '/dashboard/products', icon: Package, roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'], workspaceFeature: 'inventory', module: 'INVENTORY' },
  { name: 'Equipment', href: '/dashboard/inventory', icon: Database, roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'], workspaceFeature: 'equipment', module: 'EQUIPMENT', terminologyKey: 'equipment' },
  { name: 'Client insights', href: '/dashboard/customers/analytics', icon: LayoutDashboard, roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'], workspaceFeature: 'customerAnalytics' },
];

const salesNav: NavigationItem[] = [
  { name: 'Leads', href: '/dashboard/leads', icon: Activity, module: 'LEADS', roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'] },
  { name: 'Deals', href: '/dashboard/deals', icon: CreditCard, module: 'DEALS', roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'] },
  { name: 'Quotations', href: '/dashboard/quotations', icon: FileCheck, module: 'QUOTATIONS', roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'] },
  { name: 'Invoices', href: '/dashboard/invoices', icon: Receipt, module: 'INVOICES', roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'] },
  { name: 'Calendar', href: '/dashboard/calendar', icon: CalendarIcon, roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'] },
  { name: 'Tasks', href: '/dashboard/tasks', icon: ClipboardList, roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'] },
  {
    name: 'More sales',
    href: '/dashboard/analytics',
    icon: BarChart3,
    roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'],
    children: [
      { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3, roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'] },
      { name: 'Team', href: '/dashboard/team', icon: Users, roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'] },
      { name: 'Duplicates', href: '/dashboard/duplicates', icon: Copy, roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'] },
      { name: 'WhatsApp', href: '/dashboard/whatsapp', icon: MessageCircle, module: 'WHATSAPP', roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'] },
    ],
  },
];

const supportNav: NavigationItem[] = [
  { name: 'Tickets', href: '/dashboard/tickets', icon: List, roles: ['ADMIN', 'SUPPORT_MANAGER', 'TECHNICIAN', 'SALES', 'SUPER_ADMIN'], module: 'TICKETS' },
  { name: 'AMC / CMC', href: '/dashboard/contracts', icon: FileText, roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'], module: 'TICKETS' },
  { name: 'Service reports', href: '/dashboard/service-reports', icon: FileCheck, roles: ['ADMIN', 'SUPPORT_MANAGER', 'TECHNICIAN', 'SUPER_ADMIN'], module: 'SERVICE_REPORTS', workspaceFeature: 'serviceHistory' },
  { name: 'My tickets', href: '/portal/tickets', icon: List, roles: ['CUSTOMER'] },
  {
    name: 'Support tools',
    href: '/dashboard/support',
    icon: LifeBuoy,
    roles: ['ADMIN', 'SUPPORT_MANAGER', 'TECHNICIAN', 'SALES', 'SUPER_ADMIN'],
    module: 'TICKETS',
    children: [
      { name: 'Support desk', href: '/dashboard/support', icon: LifeBuoy, roles: ['ADMIN', 'SUPPORT_MANAGER', 'TECHNICIAN', 'SALES', 'SUPER_ADMIN'] },
      { name: 'Inbox', href: '/dashboard/support/inbox', icon: Inbox, module: 'SUPPORT_INBOX', roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'] },
      { name: 'SLA policies', href: '/dashboard/support/sla-policies', icon: Clock, module: 'SUPPORT_SLA', roles: ['ADMIN', 'SUPPORT_MANAGER', 'SUPER_ADMIN'] },
      { name: 'Knowledge base', href: '/dashboard/support/knowledge', icon: BookOpen, module: 'SUPPORT_KNOWLEDGE', roles: ['ADMIN', 'SUPPORT_MANAGER', 'TECHNICIAN', 'SALES', 'SUPER_ADMIN'] },
      { name: 'Canned replies', href: '/dashboard/support/canned-responses', icon: MessageSquare, module: 'SUPPORT_CANNED', roles: ['ADMIN', 'SUPPORT_MANAGER', 'TECHNICIAN', 'SALES', 'SUPER_ADMIN'] },
      { name: 'Agent groups', href: '/dashboard/support/groups', icon: Users, module: 'SUPPORT_GROUPS', roles: ['ADMIN', 'SUPPORT_MANAGER', 'SUPER_ADMIN'] },
      { name: 'Automation', href: '/dashboard/support/automation', icon: Zap, roles: ['ADMIN', 'SUPPORT_MANAGER', 'SUPER_ADMIN'] },
      { name: 'Analytics', href: '/dashboard/support/analytics', icon: BarChart3, roles: ['ADMIN', 'SUPPORT_MANAGER', 'SUPER_ADMIN'] },
    ],
  },
  {
    name: 'Field tools',
    href: '/dashboard/service/gps',
    icon: MapPin,
    roles: ['ADMIN', 'SUPPORT_MANAGER', 'TECHNICIAN', 'SUPER_ADMIN'],
    workspaceFeature: 'fieldService',
    children: [
      { name: 'GPS tracking', href: '/dashboard/service/gps', icon: MapPin, module: 'SERVICE_GPS' },
      { name: 'Expenses', href: '/dashboard/service/expenses', icon: Route, module: 'SERVICE_EXPENSES' },
      { name: 'Cash on hand', href: '/dashboard/service/cash', icon: Wallet, module: 'SERVICE_CASH' },
    ],
  },
];

const saasNav: NavigationItem[] = [
  { name: 'SaaS Dashboard', href: '/admin', icon: ShieldAlert, roles: ['SUPER_ADMIN'] },
  { name: 'Companies', href: '/admin/companies', icon: Building2, roles: ['SUPER_ADMIN'] },
  { name: 'User Management', href: '/admin/users', icon: Users, roles: ['SUPER_ADMIN'] },
  { name: 'Subscriptions', href: '/admin/subscriptions', icon: BillingIcon, roles: ['SUPER_ADMIN'] },
  { name: 'Plans', href: '/admin/plans', icon: CreditCard, roles: ['SUPER_ADMIN'] },
  { name: 'Email logs', href: '/admin/emails', icon: Mail, roles: ['SUPER_ADMIN'] },
  { name: 'Activity', href: '/admin/activity', icon: Activity, roles: ['SUPER_ADMIN'] },
  { name: 'Platform Settings', href: '/admin/settings', icon: Settings, roles: ['SUPER_ADMIN'] },
];

const emailNav: NavigationItem[] = [
  {
    name: 'Email',
    href: '/dashboard/emails',
    icon: Mail,
    module: 'EMAIL_OUTREACH',
    roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'],
    children: [
      { name: 'Inbox', href: '/dashboard/emails?folder=inbox', icon: Mail, roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'] },
      { name: 'Sent', href: '/dashboard/emails?folder=sent', icon: Send, roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'] },
      { name: 'Drafts', href: '/dashboard/emails?folder=drafts', icon: FileText, roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'] },
      { name: 'Starred', href: '/dashboard/emails?folder=starred', icon: Star, roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'] },
      { name: 'Trash', href: '/dashboard/emails?folder=trash', icon: Trash2, roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'] },
      { name: 'Campaigns', href: '/dashboard/campaigns', icon: MailOpen, roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'] },
      { name: 'Sequences', href: '/dashboard/sequences', icon: Activity, roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'] },
      { name: 'Templates', href: '/dashboard/email-templates', icon: FileText, roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'] },
    ]
  }
];

const opsNav: NavigationItem[] = [
  { name: 'Suppliers', href: '/dashboard/suppliers', icon: Truck, roles: ['ADMIN', 'SUPER_ADMIN'], module: 'INVENTORY' },
  { name: 'Purchase orders', href: '/dashboard/purchase-orders', icon: ClipboardList, roles: ['ADMIN', 'SUPER_ADMIN'], module: 'INVENTORY' },
  { name: 'Sales orders', href: '/dashboard/sales-orders', icon: ShoppingCart, roles: ['ADMIN', 'SUPER_ADMIN'], module: 'INVENTORY' },
  { name: 'Assets', href: '/dashboard/assets', icon: Landmark, roles: ['ADMIN', 'SUPER_ADMIN'] },
  { name: 'Budgets', href: '/dashboard/budgets', icon: PiggyBank, roles: ['ADMIN', 'SUPER_ADMIN'] },
  { name: 'Expenses', href: '/dashboard/expenses', icon: Receipt, roles: ['ADMIN', 'SUPER_ADMIN'] },
  { name: 'Projects', href: '/dashboard/projects', icon: FolderKanban, roles: ['ADMIN', 'SUPER_ADMIN'] },
  { name: 'Workflows', href: '/dashboard/workflows', icon: Zap, roles: ['ADMIN', 'SALES', 'SUPER_ADMIN'] },
];

const settingsNav: NavigationItem[] = [
  { name: 'Reporting', href: '/dashboard/reports', icon: BarChart3, roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'] },
  { name: 'Messages', href: '/dashboard/messages', icon: MessageSquare, roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'TECHNICIAN', 'SUPER_ADMIN'] },
  { name: 'Documentation', href: '/dashboard/docs', icon: BookOpen },
  {
    name: 'Settings',
    href: '/dashboard/settings',
    icon: Settings,
    roles: ['ADMIN', 'SUPER_ADMIN'],
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
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);
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
      { name: 'Attendance', href: '/dashboard/attendance', icon: Clock, roles: ['ADMIN', 'SUPER_ADMIN'] },
      { name: 'Approve staff', href: '/dashboard/approve-employees', icon: FileCheck, roles: ['ADMIN', 'SUPER_ADMIN'] },
      { name: 'Payroll', href: '/dashboard/payroll', icon: Wallet, roles: ['ADMIN', 'SUPER_ADMIN'] },
      { name: 'Leave requests', href: '/dashboard/leave-requests', icon: CalendarIcon, roles: ['ADMIN', 'SUPER_ADMIN'] },
      { name: 'Announcements', href: '/dashboard/announcements', icon: MessageSquare, roles: ['ADMIN', 'SUPER_ADMIN'] },
    ];
  }, [companySlug, userRole]);

  const myHrNav = useMemo((): NavigationItem[] => {
    if (!companySlug || !['TECHNICIAN', 'SALES', 'SUPPORT_MANAGER'].includes(userRole)) return [];
    return [
      {
        name: 'Attendance',
        href: getCompanyUrl('/employee/attendance', companySlug),
        icon: Clock,
        roles: ['TECHNICIAN', 'SALES', 'SUPPORT_MANAGER'],
      },
      {
        name: 'Leave',
        href: getCompanyUrl('/employee/leave', companySlug),
        icon: CalendarIcon,
        roles: ['TECHNICIAN', 'SALES', 'SUPPORT_MANAGER'],
      },
      {
        name: 'Payslips',
        href: getCompanyUrl('/employee/payslips', companySlug),
        icon: Wallet,
        roles: ['TECHNICIAN', 'SALES', 'SUPPORT_MANAGER'],
      },
      {
        name: 'My profile',
        href: getCompanyUrl('/employee/profile', companySlug),
        icon: User,
        roles: ['TECHNICIAN', 'SALES', 'SUPPORT_MANAGER'],
      },
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
    const childVisible = (child: NavigationItem) => {
      const childRoleOk = !child.roles || child.roles.includes(userRole);
      const childModuleOk = !child.module || moduleMap[child.module] === true;
      return childRoleOk && childModuleOk;
    };

    const filtered = items.filter((item) => {
      const roleAllowed = !item.roles || item.roles.includes(userRole);
      const moduleAllowed = !item.module || moduleMap[item.module] === true;
      const workspaceAllowed =
        !item.workspaceFeature ||
        !workspaceFeatures ||
        workspaceFeatures[item.workspaceFeature] === true;
      if (!roleAllowed || !moduleAllowed || !workspaceAllowed) return false;
      if (item.children?.length) {
        return item.children.some(childVisible);
      }
      return true;
    });
    if (filtered.length === 0) return null;

    const labelFor = (item: NavigationItem) => {
      if (item.terminologyKey && terminology?.[item.terminologyKey]) {
        return terminology[item.terminologyKey];
      }
      return item.name;
    };

    return (
      <div className="py-1.5">
        {title && (
          <h3 className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/80">
            {title}
          </h3>
        )}
        <div className="space-y-0.5">
          {filtered.map((item) => (
            <div key={item.name}>
              {item.children ? (
                <>
                  <Button
                    variant={isParentActive(item) ? "secondary" : "ghost"}
                    className={cn(
                      "w-full justify-between h-8",
                      isParentActive(item) && "bg-muted/50 font-medium"
                    )}
                    onClick={() => toggleMenu(item.name)}
                  >
                    <div className="flex items-center">
                      <item.icon className={cn(
                        "mr-2.5 h-4 w-4",
                        isParentActive(item) ? "text-foreground" : "text-muted-foreground"
                      )} />
                      <span className="text-sm font-medium">{labelFor(item)}</span>
                    </div>
                    {expandedMenus.includes(item.name) ? (
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    ) : (
                      <ChevronRight className="h-4 w-4 opacity-50" />
                    )}
                  </Button>
                  {expandedMenus.includes(item.name) && (
                    <div className="ml-4 mt-0.5 space-y-0.5 border-l pl-2">
                      {item.children
                        .filter(childVisible)
                        .map((child) => (
                        <Button
                          key={child.name}
                          variant={isActive(child.href) ? "secondary" : "ghost"}
                          className={cn(
                            "w-full justify-start text-sm h-7",
                            isActive(child.href) ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground"
                          )}
                          asChild
                          onClick={onNavigate}
                        >
                          <Link href={resolveHref(child.href)}>
                            <child.icon className={cn(
                              "mr-2 h-3.5 w-3.5",
                              isActive(child.href) ? "text-foreground" : "text-muted-foreground"
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
                    "w-full justify-start h-8 px-3",
                    isActive(item.href)
                      ? "bg-muted font-medium text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                  asChild
                  onClick={onNavigate}
                >
                  <Link href={resolveHref(item.href)}>
                    <item.icon className={cn(
                      "mr-2.5 h-4 w-4",
                      isActive(item.href) ? "text-foreground" : "text-muted-foreground"
                    )} />
                    <span className="text-sm font-medium">{labelFor(item)}</span>
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
    <div className="w-64 border-r h-full bg-background overflow-y-auto overscroll-contain [scrollbar-width:thin]">
      <div className="space-y-1 py-3 px-2">
        <div className="px-2 pb-3 mb-1 border-b">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-teal-600" />
            <h2 className="text-sm font-semibold text-foreground truncate">
              {brand.appName}
            </h2>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Sales & service
          </p>
        </div>

        {renderNavGroup(mainNav)}
        {workspaceAdminNav.length > 0 && renderNavGroup(workspaceAdminNav, "Admin")}
        {hrNav.length > 0 && renderNavGroup(hrNav, "People")}
        {myHrNav.length > 0 && renderNavGroup(myHrNav, "My HR")}
        {userRole === 'SUPER_ADMIN' && renderNavGroup(saasNav, "Platform")}
        {renderNavGroup(crmNav, "Clients & catalog")}
        {userRole !== 'TECHNICIAN' && renderNavGroup(salesNav, "Sales")}
        {renderNavGroup(supportNav, "Service")}
        {['ADMIN', 'SUPER_ADMIN'].includes(userRole) && renderNavGroup(opsNav, "Ops")}
        {userRole !== 'TECHNICIAN' && userRole !== 'CUSTOMER' && renderNavGroup(emailNav, "Outreach")}
        {renderNavGroup(settingsNav, "Settings")}
      </div>
    </div>
  );
}
