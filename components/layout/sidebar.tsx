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
  Stethoscope,
  Activity,
  ShieldAlert,
  Globe,
  CreditCard as BillingIcon,
  MessageCircle,
  Wallet,
  Route,
  MapPin
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

interface NavigationItem {
  name: string;
  href: string;
  icon: any;
  children?: NavigationItem[];
  roles?: string[];
  module?: string;
}

const mainNav: NavigationItem[] = [
  { name: 'Admin Hub', href: '/dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'] },
  { name: 'Hospital Portal', href: '/portal', icon: LayoutDashboard, roles: ['CUSTOMER', 'ADMIN', 'SUPER_ADMIN'] },
  { name: 'Technician Desk', href: '/dashboard/technician', icon: Wrench, roles: ['TECHNICIAN', 'ADMIN', 'SUPER_ADMIN'] },
];

const crmNav: NavigationItem[] = [
  { name: 'Customer Dash', href: '/dashboard/customers/analytics', icon: LayoutDashboard, roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'] },
  { name: 'Hospitals', href: '/dashboard/customers', icon: Users, roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'] },
  { name: 'Inventory', href: '/dashboard/products', icon: Stethoscope, roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'] },
  { name: 'Equipments', href: '/dashboard/equipment', icon: Database, roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'] },
];

const salesNav: NavigationItem[] = [
  { name: 'Leads Pipeline', href: '/dashboard/leads', icon: Activity, module: 'LEADS' },
  { name: 'Quotations', href: '/dashboard/quotations', icon: FileCheck, module: 'QUOTATIONS' },
  { name: 'Invoices', href: '/dashboard/invoices', icon: Receipt, module: 'INVOICES' },
  { name: 'Deals', href: '/dashboard/deals', icon: CreditCard, module: 'DEALS' },
  { name: 'WhatsApp Hub', href: '/dashboard/whatsapp', icon: MessageCircle, module: 'WHATSAPP' },
];

const supportNav: NavigationItem[] = [
  { name: 'Ticket Queue', href: '/dashboard/tickets', icon: List, roles: ['ADMIN', 'SUPPORT_MANAGER', 'TECHNICIAN', 'SALES', 'SUPER_ADMIN'], module: 'TICKETS' },
  { name: 'My Tickets', href: '/portal/tickets', icon: List, roles: ['CUSTOMER'] },
  { name: 'Service Reports', href: '/dashboard/service-reports', icon: FileCheck, roles: ['ADMIN', 'SUPPORT_MANAGER', 'TECHNICIAN', 'SUPER_ADMIN'], module: 'SERVICE_REPORTS' },
  { name: 'Cash On Hand', href: '/dashboard/service/cash', icon: Wallet, roles: ['ADMIN', 'SUPPORT_MANAGER', 'TECHNICIAN', 'SUPER_ADMIN'], module: 'SERVICE_CASH' },
  { name: 'Travel & Expense', href: '/dashboard/service/expenses', icon: Route, roles: ['ADMIN', 'SUPPORT_MANAGER', 'TECHNICIAN', 'SUPER_ADMIN'], module: 'SERVICE_EXPENSES' },
  { name: 'GPS Tracking', href: '/dashboard/service/gps', icon: MapPin, roles: ['ADMIN', 'SUPPORT_MANAGER', 'TECHNICIAN', 'SUPER_ADMIN'], module: 'SERVICE_GPS' },
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

  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [expandedMenus, setExpandedMenus] = useState<string[]>(['Communication']);
  const [moduleMap, setModuleMap] = useState<Record<string, boolean>>({});

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
    const [hrefPath, hrefQuery] = href.split('?');
    if (pathname !== hrefPath) return false;
    if (!hrefQuery) return pathname === hrefPath;
    const hrefParams = new URLSearchParams(hrefQuery);
    const hrefParamsArray = Array.from(hrefParams.entries());
    for (let i = 0; i < hrefParamsArray.length; i++) {
      const [key, value] = hrefParamsArray[i];
      if (searchParams.get(key) !== value) return false;
    }
    return true;
  };

  const isParentActive = (item: NavigationItem) => {
    if (item.children) {
      return item.children.some(child => isActive(child.href) || pathname.startsWith(child.href.split('?')[0] + '/'));
    }
    return false;
  };

  const renderNavGroup = (items: NavigationItem[], title?: string) => {
    const filtered = items.filter(item => {
      const roleAllowed = !item.roles || item.roles.includes(userRole);
      const moduleAllowed = !item.module || moduleMap[item.module] !== false;
      return roleAllowed && moduleAllowed;
    });
    if (filtered.length === 0) return null;

    return (
      <div className="py-2">
        {title && <h3 className="mb-2 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">{title}</h3>}
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
                        "mr-2 h-4 w-4",
                        isParentActive(item) && "text-blue-600"
                      )} />
                      <span className="text-sm">{item.name}</span>
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
                            "w-full justify-start text-xs h-8",
                            isActive(child.href) && "bg-blue-50 text-blue-700 font-medium"
                          )}
                          asChild
                          onClick={onNavigate}
                        >
                          <Link href={child.href}>
                            <child.icon className={cn(
                              "mr-2 h-3.5 w-3.5",
                              isActive(child.href) && "text-blue-600"
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
                    "w-full justify-start h-9",
                    isActive(item.href) && "bg-blue-50 text-blue-700 font-medium border-l-2 border-blue-500 rounded-l-none ml-[-12px] pl-[12px]"
                  )}
                  asChild
                  onClick={onNavigate}
                >
                  <Link href={item.href}>
                    <item.icon className={cn(
                      "mr-2 h-4 w-4",
                      isActive(item.href) && "text-blue-600"
                    )} />
                    <span className="text-sm">{item.name}</span>
                  </Link>
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="pb-12 w-64 border-r h-full bg-background/50 backdrop-blur-sm">
      <div className="space-y-4 py-4 px-3">
        <div className="px-4 py-2 border-b mb-4">
          <h2 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Jabin CRM
          </h2>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mt-1">Medical Supply Solutions</p>
        </div>

        {renderNavGroup(mainNav, "Main")}
        {userRole === 'SUPER_ADMIN' && renderNavGroup(saasNav, "SaaS Admin")}
        {renderNavGroup(crmNav, "CRM Core")}
        {userRole !== 'TECHNICIAN' && renderNavGroup(salesNav, "Sales & Billing")}
        {renderNavGroup(supportNav, "Support")}
        {userRole !== 'TECHNICIAN' && userRole !== 'CUSTOMER' && renderNavGroup(emailNav, "Outreach")}
        {renderNavGroup(settingsNav, "System")}
      </div>
    </div>
  );
}
