/**
 * Opslane module workspaces — path → module matching and nav item catalogs.
 * Sidebar shows one module at a time; Home hub lists module entry points.
 */

import type { LucideIcon } from 'lucide-react';
import type { WorkspaceFeatureKey, WorkspaceTerminology } from '@/lib/workspace-templates';
import type { BusinessVertical } from '@/lib/workspace-templates';

export type NavItem = {
  name: string;
  href: string;
  /** Lucide icon name key resolved in the sidebar (keeps this file free of React icon imports for tests). */
  icon: string;
  children?: NavItem[];
  roles?: string[];
  module?: string;
  workspaceFeature?: WorkspaceFeatureKey;
  waiveInventoryModuleWhenNoStock?: boolean;
  terminologyKey?: keyof WorkspaceTerminology;
};

export type WorkspaceModuleId =
  | 'home'
  | 'sales'
  | 'clients'
  | 'projects'
  | 'support'
  | 'outreach'
  | 'people'
  | 'ops'
  | 'workspace'
  | 'platform';

export type WorkspaceModuleDef = {
  id: WorkspaceModuleId;
  label: string;
  description: string;
  icon: string;
  /** Landing path (dashboard-relative or absolute company path prefix handled by sidebar). */
  href: string;
  /** Higher = preferred when multiple modules match. */
  priority: number;
  /** Path prefixes relative to dashboard (without company slug), e.g. `/dashboard/projects`. */
  pathPrefixes: string[];
  /** Exact paths that belong to this module. */
  exactPaths?: string[];
  /** Agency-preferred order rank (lower first). */
  agencyOrder: number;
  /** Default order rank (lower first). */
  defaultOrder: number;
};

export const WORKSPACE_MODULES: WorkspaceModuleDef[] = [
  {
    id: 'home',
    label: 'Dashboard',
    description: 'Overview, setup, and workspace pulse',
    icon: 'Gauge',
    href: '/dashboard',
    priority: 100,
    pathPrefixes: [],
    exactPaths: ['/dashboard'],
    agencyOrder: 0,
    defaultOrder: 0,
  },
  {
    id: 'projects',
    label: 'Projects',
    description: 'Delivery, retainers, and automations',
    icon: 'FolderKanban',
    href: '/dashboard/projects',
    priority: 50,
    pathPrefixes: [
      '/dashboard/projects',
      '/dashboard/retainers',
      '/dashboard/budgets',
      '/dashboard/workflows',
      '/dashboard/timesheets',
    ],
    agencyOrder: 1,
    defaultOrder: 4,
  },
  {
    id: 'sales',
    label: 'Sales',
    description: 'Prospects, pipeline, quotes, and invoices',
    icon: 'Activity',
    href: '/dashboard/leads',
    priority: 40,
    pathPrefixes: [
      '/dashboard/leads',
      '/dashboard/deals',
      '/dashboard/quotations',
      '/dashboard/invoices',
      '/dashboard/analytics',
      '/dashboard/team',
      '/dashboard/duplicates',
    ],
    agencyOrder: 2,
    defaultOrder: 2,
  },
  {
    id: 'clients',
    label: 'Clients',
    description: 'Accounts, catalog, and insights',
    icon: 'Users',
    href: '/dashboard/customers',
    priority: 40,
    pathPrefixes: [
      '/dashboard/customers',
      '/dashboard/products',
    ],
    agencyOrder: 3,
    defaultOrder: 1,
  },
  {
    id: 'support',
    label: 'Support',
    description: 'Tickets, desk tools, and messaging',
    icon: 'LifeBuoy',
    href: '/dashboard/tickets',
    priority: 40,
    pathPrefixes: [
      '/dashboard/tickets',
      '/dashboard/whatsapp',
      '/dashboard/contracts',
      '/dashboard/service-reports',
      '/dashboard/support',
      '/dashboard/service',
      '/dashboard/technician',
    ],
    agencyOrder: 4,
    defaultOrder: 3,
  },
  {
    id: 'outreach',
    label: 'Outreach',
    description: 'Email, campaigns, and sequences',
    icon: 'Mail',
    href: '/dashboard/emails',
    priority: 40,
    pathPrefixes: [
      '/dashboard/emails',
      '/dashboard/campaigns',
      '/dashboard/sequences',
      '/dashboard/email-templates',
    ],
    agencyOrder: 5,
    defaultOrder: 5,
  },
  {
    id: 'people',
    label: 'People',
    description: 'HR, attendance, payroll, and org',
    icon: 'Briefcase',
    href: '/dashboard/employees',
    priority: 40,
    pathPrefixes: [
      '/dashboard/employees',
      '/dashboard/directory',
      '/dashboard/org-chart',
      '/dashboard/departments',
      '/dashboard/designations',
      '/dashboard/branches',
      '/dashboard/attendance',
      '/dashboard/shifts',
      '/dashboard/attendance-corrections',
      '/dashboard/onboarding-hr',
      '/dashboard/exit',
      '/dashboard/recruitment',
      '/dashboard/approve-employees',
      '/dashboard/payroll',
      '/dashboard/leave-requests',
      '/dashboard/leave-policies',
      '/dashboard/letters',
      '/dashboard/performance',
      '/dashboard/timesheets',
      '/dashboard/travel',
      '/dashboard/hr',
      '/dashboard/hr-tickets',
      '/dashboard/hr-policies',
      '/dashboard/hr-claims',
      '/dashboard/holidays',
      '/dashboard/announcements',
      '/employee',
    ],
    agencyOrder: 6,
    defaultOrder: 6,
  },
  {
    id: 'ops',
    label: 'Ops',
    description: 'Inventory, equipment, assets, and expenses',
    icon: 'Package',
    href: '/dashboard/inventory',
    priority: 30,
    pathPrefixes: [
      '/dashboard/inventory',
      '/dashboard/equipment',
      '/dashboard/demo-equipment',
      '/dashboard/suppliers',
      '/dashboard/purchase-orders',
      '/dashboard/sales-orders',
      '/dashboard/assets',
      '/dashboard/expenses',
    ],
    agencyOrder: 8,
    defaultOrder: 7,
  },
  {
    id: 'workspace',
    label: 'Workspace',
    description: 'Reports, docs, settings, and admin',
    icon: 'Settings',
    href: '/dashboard/reports',
    priority: 20,
    pathPrefixes: [
      '/dashboard/reports',
      '/dashboard/messages',
      '/dashboard/docs',
      '/dashboard/settings',
      '/dashboard/calendar',
      '/dashboard/tasks',
      '/admin',
    ],
    agencyOrder: 7,
    defaultOrder: 8,
  },
  {
    id: 'platform',
    label: 'Platform',
    description: 'SaaS control plane',
    icon: 'ShieldAlert',
    href: '/admin',
    priority: 10,
    pathPrefixes: ['/admin/companies', '/admin/users', '/admin/subscriptions', '/admin/plans', '/admin/emails', '/admin/activity', '/admin/settings'],
    exactPaths: ['/admin'],
    agencyOrder: 9,
    defaultOrder: 9,
  },
];

/** Strip company slug so `/acme/dashboard/projects` → `/dashboard/projects`. */
export function normalizeDashboardPath(pathname: string): string {
  if (!pathname) return '/dashboard';
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0) return '/dashboard';

  // /{company}/dashboard/...
  const dashIdx = parts.indexOf('dashboard');
  if (dashIdx >= 0) {
    return '/' + parts.slice(dashIdx).join('/');
  }
  // /{company}/employee/...
  const empIdx = parts.indexOf('employee');
  if (empIdx >= 0) {
    return '/' + parts.slice(empIdx).join('/');
  }
  // /{company}/admin or /admin
  const adminIdx = parts.indexOf('admin');
  if (adminIdx >= 0) {
    return '/' + parts.slice(adminIdx).join('/');
  }
  // /portal
  if (parts[0] === 'portal') {
    return '/' + parts.join('/');
  }
  return pathname.startsWith('/') ? pathname : `/${pathname}`;
}

export function resolveModuleId(
  pathname: string,
  options?: { vertical?: BusinessVertical | string | null }
): WorkspaceModuleId {
  const path = normalizeDashboardPath(pathname);
  const vertical = options?.vertical ?? null;

  // Exact home
  if (path === '/dashboard' || path === '/dashboard/') {
    return 'home';
  }

  // Portal entry from staff sidebar
  if (path.startsWith('/portal')) {
    return 'support';
  }

  // Automations: projects for web_agency, workspace otherwise
  if (path.startsWith('/dashboard/workflows')) {
    return vertical === 'web_agency' ? 'projects' : 'workspace';
  }

  // Budgets: projects for web_agency, ops otherwise
  if (path.startsWith('/dashboard/budgets')) {
    return vertical === 'web_agency' ? 'projects' : 'ops';
  }

  // Timesheets: projects for web_agency, people otherwise
  if (path.startsWith('/dashboard/timesheets')) {
    return vertical === 'web_agency' ? 'projects' : 'people';
  }

  // Calendar / tasks live under workspace (cross-cutting work)
  if (path.startsWith('/dashboard/calendar') || path.startsWith('/dashboard/tasks')) {
    return 'workspace';
  }

  let best: { id: WorkspaceModuleId; priority: number; prefixLen: number } | null = null;

  for (const mod of WORKSPACE_MODULES) {
    if (mod.id === 'home') continue;

    if (mod.exactPaths?.some((p) => path === p || path === `${p}/`)) {
      const candidate = { id: mod.id, priority: mod.priority + 5, prefixLen: (mod.exactPaths[0] || '').length };
      if (!best || candidate.priority > best.priority || (candidate.priority === best.priority && candidate.prefixLen > best.prefixLen)) {
        best = candidate;
      }
      continue;
    }

    for (const prefix of mod.pathPrefixes) {
      if (path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`)) {
        const candidate = { id: mod.id, priority: mod.priority, prefixLen: prefix.length };
        if (
          !best ||
          candidate.priority > best.priority ||
          (candidate.priority === best.priority && candidate.prefixLen > best.prefixLen)
        ) {
          best = candidate;
        }
      }
    }
  }

  return best?.id ?? 'home';
}

export function getModuleDef(id: WorkspaceModuleId): WorkspaceModuleDef {
  return WORKSPACE_MODULES.find((m) => m.id === id) ?? WORKSPACE_MODULES[0]!;
}

export function orderedModulesForVertical(
  vertical?: BusinessVertical | string | null
): WorkspaceModuleDef[] {
  const agency = vertical === 'web_agency';
  return [...WORKSPACE_MODULES]
    .filter((m) => m.id !== 'home')
    .sort((a, b) => (agency ? a.agencyOrder : a.defaultOrder) - (agency ? b.agencyOrder : b.defaultOrder));
}

/** Hub cards — exclude platform for non–super-admin (filtered by caller). */
export function hubModulesForVertical(
  vertical?: BusinessVertical | string | null
): WorkspaceModuleDef[] {
  const agency = vertical === 'web_agency';
  const list = orderedModulesForVertical(vertical).filter((m) => {
    if (agency && m.id === 'ops') return false; // de-emphasize inventory/field for agencies
    return true;
  });
  return list;
}

// ── Nav catalogs (icon keys resolved in sidebar) ─────────────────────────────

export const MAIN_NAV: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: 'Gauge', roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'] },
  { name: 'Client portal', href: '/portal', icon: 'Globe', roles: ['CUSTOMER', 'ADMIN', 'SUPER_ADMIN'], workspaceFeature: 'customerPortal' },
  { name: 'My field work', href: '/dashboard/technician', icon: 'Wrench', roles: ['TECHNICIAN', 'ADMIN', 'SUPER_ADMIN'], workspaceFeature: 'fieldService' },
];

export const CLIENTS_NAV: NavItem[] = [
  { name: 'Clients', href: '/dashboard/customers', icon: 'Users', roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'], workspaceFeature: 'customers', terminologyKey: 'customers' },
  { name: 'Products', href: '/dashboard/products', icon: 'Package', roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'], workspaceFeature: 'products', module: 'INVENTORY', waiveInventoryModuleWhenNoStock: true },
  { name: 'Client insights', href: '/dashboard/customers/analytics', icon: 'LayoutDashboard', roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'], workspaceFeature: 'customerAnalytics' },
];

export const SALES_NAV: NavItem[] = [
  { name: 'Leads', href: '/dashboard/leads', icon: 'Activity', module: 'LEADS', roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'], terminologyKey: 'leads' },
  { name: 'Deals', href: '/dashboard/deals', icon: 'CreditCard', module: 'DEALS', roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'], terminologyKey: 'deals' },
  { name: 'Quotations', href: '/dashboard/quotations', icon: 'FileCheck', module: 'QUOTATIONS', roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'] },
  { name: 'Invoices', href: '/dashboard/invoices', icon: 'Receipt', module: 'INVOICES', roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'] },
  {
    name: 'More sales',
    href: '/dashboard/analytics',
    icon: 'BarChart3',
    roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'],
    children: [
      { name: 'Analytics', href: '/dashboard/analytics', icon: 'BarChart3', roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'] },
      { name: 'Team performance', href: '/dashboard/team', icon: 'Users', roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'] },
      { name: 'Duplicates', href: '/dashboard/duplicates', icon: 'Copy', roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'] },
    ],
  },
];

export const PROJECTS_NAV: NavItem[] = [
  { name: 'Projects', href: '/dashboard/projects', icon: 'FolderKanban', roles: ['ADMIN', 'SUPER_ADMIN', 'SALES'] },
  { name: 'Retainers', href: '/dashboard/retainers', icon: 'RefreshCw', roles: ['ADMIN', 'SUPER_ADMIN'] },
  { name: 'Budgets', href: '/dashboard/budgets', icon: 'PiggyBank', roles: ['ADMIN', 'SUPER_ADMIN'] },
  { name: 'Timesheets', href: '/dashboard/timesheets', icon: 'Clock', roles: ['ADMIN', 'SUPER_ADMIN'] },
  { name: 'Automations', href: '/dashboard/workflows', icon: 'Zap', roles: ['ADMIN', 'SALES', 'SUPER_ADMIN'] },
];

export const HOME_WORK_NAV: NavItem[] = [
  { name: 'Calendar', href: '/dashboard/calendar', icon: 'Calendar', roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'] },
  { name: 'Tasks', href: '/dashboard/tasks', icon: 'ClipboardList', roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'] },
];

export const SUPPORT_NAV: NavItem[] = [
  { name: 'Tickets', href: '/dashboard/tickets', icon: 'List', roles: ['ADMIN', 'SUPPORT_MANAGER', 'TECHNICIAN', 'SALES', 'SUPER_ADMIN'], module: 'TICKETS', terminologyKey: 'tickets' },
  { name: 'WhatsApp', href: '/dashboard/whatsapp', icon: 'MessageCircle', module: 'WHATSAPP', roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'TECHNICIAN', 'SUPER_ADMIN'] },
  { name: 'Contracts', href: '/dashboard/contracts', icon: 'FileText', roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'], module: 'TICKETS', workspaceFeature: 'warranties' },
  { name: 'Service reports', href: '/dashboard/service-reports', icon: 'FileCheck', roles: ['ADMIN', 'SUPPORT_MANAGER', 'TECHNICIAN', 'SUPER_ADMIN'], module: 'SERVICE_REPORTS', workspaceFeature: 'serviceHistory' },
  { name: 'My tickets', href: '/portal/tickets', icon: 'List', roles: ['CUSTOMER'] },
  {
    name: 'Support tools',
    href: '/dashboard/support',
    icon: 'LifeBuoy',
    roles: ['ADMIN', 'SUPPORT_MANAGER', 'TECHNICIAN', 'SALES', 'SUPER_ADMIN'],
    module: 'TICKETS',
    children: [
      { name: 'Support desk', href: '/dashboard/support', icon: 'LifeBuoy', roles: ['ADMIN', 'SUPPORT_MANAGER', 'TECHNICIAN', 'SALES', 'SUPER_ADMIN'] },
      { name: 'Inbox', href: '/dashboard/support/inbox', icon: 'Inbox', module: 'SUPPORT_INBOX', roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'] },
      { name: 'Live chat', href: '/dashboard/support/live-chat', icon: 'MessageCircle', module: 'SUPPORT_LIVE_CHAT', roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'] },
      { name: 'SLA policies', href: '/dashboard/support/sla-policies', icon: 'Clock', module: 'SUPPORT_SLA', roles: ['ADMIN', 'SUPPORT_MANAGER', 'SUPER_ADMIN'] },
      { name: 'Knowledge base', href: '/dashboard/support/knowledge', icon: 'BookOpen', module: 'SUPPORT_KNOWLEDGE', roles: ['ADMIN', 'SUPPORT_MANAGER', 'TECHNICIAN', 'SALES', 'SUPER_ADMIN'] },
      { name: 'Canned replies', href: '/dashboard/support/canned-responses', icon: 'MessageSquare', module: 'SUPPORT_CANNED', roles: ['ADMIN', 'SUPPORT_MANAGER', 'TECHNICIAN', 'SALES', 'SUPER_ADMIN'] },
      { name: 'Agent groups', href: '/dashboard/support/groups', icon: 'Users', module: 'SUPPORT_GROUPS', roles: ['ADMIN', 'SUPPORT_MANAGER', 'SUPER_ADMIN'] },
      { name: 'Ticket automation', href: '/dashboard/support/automation', icon: 'Zap', roles: ['ADMIN', 'SUPPORT_MANAGER', 'SUPER_ADMIN'] },
      { name: 'Custom fields', href: '/dashboard/support/custom-fields', icon: 'List', roles: ['ADMIN', 'SUPPORT_MANAGER', 'SUPER_ADMIN'] },
      { name: 'Business hours', href: '/dashboard/support/business-hours', icon: 'Clock', roles: ['ADMIN', 'SUPPORT_MANAGER', 'SUPER_ADMIN'] },
      { name: 'Roadmap', href: '/dashboard/support/roadmap', icon: 'LayoutGrid', roles: ['ADMIN', 'SUPPORT_MANAGER', 'SUPER_ADMIN'] },
      { name: 'Freshdesk import', href: '/dashboard/support/migrate', icon: 'Database', roles: ['ADMIN', 'SUPER_ADMIN'] },
      { name: 'Analytics', href: '/dashboard/support/analytics', icon: 'BarChart3', roles: ['ADMIN', 'SUPPORT_MANAGER', 'SUPER_ADMIN'] },
    ],
  },
  {
    name: 'Field tools',
    href: '/dashboard/service/gps',
    icon: 'MapPin',
    roles: ['ADMIN', 'SUPPORT_MANAGER', 'TECHNICIAN', 'SUPER_ADMIN'],
    workspaceFeature: 'fieldService',
    children: [
      { name: 'Job board', href: '/dashboard/service/board', icon: 'LayoutGrid', module: 'TICKETS', workspaceFeature: 'fieldService' },
      { name: 'Service analytics', href: '/dashboard/service/analytics', icon: 'BarChart3', module: 'TICKETS', workspaceFeature: 'fieldService', roles: ['ADMIN', 'SUPPORT_MANAGER', 'SUPER_ADMIN'] },
      { name: 'GPS tracking', href: '/dashboard/service/gps', icon: 'MapPin', module: 'SERVICE_GPS', workspaceFeature: 'fieldService' },
      { name: 'Expenses', href: '/dashboard/service/expenses', icon: 'Route', module: 'SERVICE_EXPENSES', workspaceFeature: 'fieldService' },
      { name: 'Cash on hand', href: '/dashboard/service/cash', icon: 'Wallet', module: 'SERVICE_CASH', workspaceFeature: 'fieldService' },
    ],
  },
];

export const OUTREACH_NAV: NavItem[] = [
  {
    name: 'Email',
    href: '/dashboard/emails',
    icon: 'Mail',
    module: 'EMAIL_OUTREACH',
    roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'],
    children: [
      { name: 'Inbox', href: '/dashboard/emails?folder=inbox', icon: 'Mail', roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'] },
      { name: 'Sent', href: '/dashboard/emails?folder=sent', icon: 'Send', roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'] },
      { name: 'Drafts', href: '/dashboard/emails?folder=drafts', icon: 'FileText', roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'] },
      { name: 'Starred', href: '/dashboard/emails?folder=starred', icon: 'Star', roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'] },
      { name: 'Trash', href: '/dashboard/emails?folder=trash', icon: 'Trash2', roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'] },
      { name: 'Campaigns', href: '/dashboard/campaigns', icon: 'MailOpen', roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'] },
      { name: 'Sequences', href: '/dashboard/sequences', icon: 'Activity', roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'] },
      { name: 'Templates', href: '/dashboard/email-templates', icon: 'FileText', roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'] },
      { name: 'Email integration', href: '/dashboard/settings/integrations?panel=email', icon: 'Settings', roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'] },
    ],
  },
];

export const OPS_NAV: NavItem[] = [
  {
    name: 'Inventory',
    href: '/dashboard/inventory',
    icon: 'Database',
    roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'],
    workspaceFeature: 'inventory',
    module: 'INVENTORY',
    children: [
      { name: 'Stock overview', href: '/dashboard/inventory', icon: 'Database', roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'], workspaceFeature: 'inventory', module: 'INVENTORY' },
      { name: 'Locations', href: '/dashboard/inventory/locations', icon: 'MapPin', roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'], workspaceFeature: 'inventory', module: 'INVENTORY' },
      { name: 'Transfers', href: '/dashboard/inventory/transfers', icon: 'ArrowLeftRight', roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'], workspaceFeature: 'inventory', module: 'INVENTORY' },
      { name: 'Batches', href: '/dashboard/inventory/batches', icon: 'ClipboardList', roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'], workspaceFeature: 'inventory', module: 'INVENTORY' },
      { name: 'Stock adjustment', href: '/dashboard/inventory/stock-adjustment', icon: 'Package', roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'], workspaceFeature: 'inventory', module: 'INVENTORY' },
    ],
  },
  {
    name: 'Installed equipment',
    href: '/dashboard/equipment',
    icon: 'Wrench',
    roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'],
    workspaceFeature: 'equipment',
    module: 'EQUIPMENT',
    terminologyKey: 'equipment',
    children: [
      { name: 'Fleet', href: '/dashboard/equipment', icon: 'Wrench', roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'], workspaceFeature: 'equipment', module: 'EQUIPMENT' },
      { name: 'Register unit', href: '/dashboard/inventory/new', icon: 'Wrench', roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'], workspaceFeature: 'equipment', module: 'EQUIPMENT' },
      { name: 'Demo fleet', href: '/dashboard/demo-equipment', icon: 'Truck', roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'], workspaceFeature: 'equipment', module: 'EQUIPMENT' },
    ],
  },
  { name: 'Suppliers', href: '/dashboard/suppliers', icon: 'Truck', roles: ['ADMIN', 'SUPER_ADMIN'], module: 'INVENTORY', workspaceFeature: 'inventory' },
  { name: 'Purchase orders', href: '/dashboard/purchase-orders', icon: 'ClipboardList', roles: ['ADMIN', 'SUPER_ADMIN'], module: 'INVENTORY', workspaceFeature: 'inventory' },
  { name: 'Sales orders', href: '/dashboard/sales-orders', icon: 'ShoppingCart', roles: ['ADMIN', 'SUPER_ADMIN'], module: 'INVENTORY', workspaceFeature: 'inventory' },
  { name: 'Assets', href: '/dashboard/assets', icon: 'Landmark', roles: ['ADMIN', 'SUPER_ADMIN'] },
  { name: 'Budgets', href: '/dashboard/budgets', icon: 'PiggyBank', roles: ['ADMIN', 'SUPER_ADMIN'] },
  { name: 'Expenses', href: '/dashboard/expenses', icon: 'Receipt', roles: ['ADMIN', 'SUPER_ADMIN'] },
];

/** People nav grouped for sidebar section headers */
export const PEOPLE_NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Org',
    items: [
      { name: 'Employees', href: '/dashboard/employees', icon: 'Users', roles: ['ADMIN', 'SUPER_ADMIN'] },
      { name: 'Directory', href: '/dashboard/directory', icon: 'Users', roles: ['ADMIN', 'SUPER_ADMIN'] },
      { name: 'Org chart', href: '/dashboard/org-chart', icon: 'Users', roles: ['ADMIN', 'SUPER_ADMIN'] },
      { name: 'Departments', href: '/dashboard/departments', icon: 'Building2', roles: ['ADMIN', 'SUPER_ADMIN'] },
      { name: 'Designations', href: '/dashboard/designations', icon: 'Briefcase', roles: ['ADMIN', 'SUPER_ADMIN'] },
      { name: 'Branches', href: '/dashboard/branches', icon: 'MapPin', roles: ['ADMIN', 'SUPER_ADMIN'] },
      { name: 'Approve staff', href: '/dashboard/approve-employees', icon: 'FileCheck', roles: ['ADMIN', 'SUPER_ADMIN'] },
    ],
  },
  {
    title: 'Time',
    items: [
      { name: 'Attendance', href: '/dashboard/attendance', icon: 'Clock', roles: ['ADMIN', 'SUPER_ADMIN'] },
      { name: 'Shifts', href: '/dashboard/shifts', icon: 'Clock', roles: ['ADMIN', 'SUPER_ADMIN'] },
      { name: 'Regularization', href: '/dashboard/attendance-corrections', icon: 'Clock', roles: ['ADMIN', 'SUPER_ADMIN'] },
      { name: 'Timesheets', href: '/dashboard/timesheets', icon: 'Clock', roles: ['ADMIN', 'SUPER_ADMIN'] },
      { name: 'Travel', href: '/dashboard/travel', icon: 'MapPin', roles: ['ADMIN', 'SUPER_ADMIN'] },
    ],
  },
  {
    title: 'Leave',
    items: [
      { name: 'Leave requests', href: '/dashboard/leave-requests', icon: 'Calendar', roles: ['ADMIN', 'SUPER_ADMIN'] },
      { name: 'Leave policies', href: '/dashboard/leave-policies', icon: 'Calendar', roles: ['ADMIN', 'SUPER_ADMIN'] },
      { name: 'Holidays', href: '/dashboard/holidays', icon: 'Calendar', roles: ['ADMIN', 'SUPER_ADMIN'] },
    ],
  },
  {
    title: 'Payroll',
    items: [
      { name: 'Payroll', href: '/dashboard/payroll', icon: 'Wallet', roles: ['ADMIN', 'SUPER_ADMIN'] },
      { name: 'Compliance', href: '/dashboard/payroll/compliance', icon: 'Wallet', roles: ['ADMIN', 'SUPER_ADMIN'] },
      { name: 'Claims', href: '/dashboard/hr-claims', icon: 'Wallet', roles: ['ADMIN', 'SUPER_ADMIN'] },
    ],
  },
  {
    title: 'Talent',
    items: [
      { name: 'Onboarding', href: '/dashboard/onboarding-hr', icon: 'FileCheck', roles: ['ADMIN', 'SUPER_ADMIN'] },
      { name: 'Exit', href: '/dashboard/exit', icon: 'User', roles: ['ADMIN', 'SUPER_ADMIN'] },
      { name: 'Recruitment', href: '/dashboard/recruitment', icon: 'Users', roles: ['ADMIN', 'SUPER_ADMIN'] },
      { name: 'Performance', href: '/dashboard/performance', icon: 'Briefcase', roles: ['ADMIN', 'SUPER_ADMIN'] },
      { name: 'Letters', href: '/dashboard/letters', icon: 'FileCheck', roles: ['ADMIN', 'SUPER_ADMIN'] },
    ],
  },
  {
    title: 'Comms',
    items: [
      { name: 'HR analytics', href: '/dashboard/hr/analytics', icon: 'Activity', roles: ['ADMIN', 'SUPER_ADMIN'] },
      { name: 'HR tickets', href: '/dashboard/hr-tickets', icon: 'MessageSquare', roles: ['ADMIN', 'SUPER_ADMIN'] },
      { name: 'Policies', href: '/dashboard/hr-policies', icon: 'FileCheck', roles: ['ADMIN', 'SUPER_ADMIN'] },
      { name: 'Announcements', href: '/dashboard/announcements', icon: 'MessageSquare', roles: ['ADMIN', 'SUPER_ADMIN'] },
    ],
  },
];

export const PEOPLE_ADMIN_NAV: NavItem[] = PEOPLE_NAV_SECTIONS.flatMap((s) => s.items);

export const WORKSPACE_NAV: NavItem[] = [
  { name: 'Reporting', href: '/dashboard/reports', icon: 'BarChart3', roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'] },
  { name: 'Calendar', href: '/dashboard/calendar', icon: 'Calendar', roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'] },
  { name: 'Tasks', href: '/dashboard/tasks', icon: 'ClipboardList', roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'SUPER_ADMIN'] },
  { name: 'Messages', href: '/dashboard/messages', icon: 'MessageSquare', roles: ['ADMIN', 'SUPPORT_MANAGER', 'SALES', 'TECHNICIAN', 'SUPER_ADMIN'] },
  { name: 'Documentation', href: '/dashboard/docs', icon: 'BookOpen' },
  { name: 'Automations', href: '/dashboard/workflows', icon: 'Zap', roles: ['ADMIN', 'SALES', 'SUPER_ADMIN'] },
  {
    name: 'Settings',
    href: '/dashboard/settings',
    icon: 'Settings',
    roles: ['ADMIN', 'SUPER_ADMIN'],
    children: [
      { name: 'Account', href: '/dashboard/settings', icon: 'Settings' },
      { name: 'Integrations', href: '/dashboard/settings/integrations', icon: 'Plug' },
      { name: 'Personal settings', href: '/dashboard/settings/advanced', icon: 'User' },
      { name: 'Billing', href: '/dashboard/settings/subscription', icon: 'CreditCard' },
      { name: 'Data migration', href: '/dashboard/settings/migration', icon: 'Database' },
      { name: 'Pipelines', href: '/dashboard/settings/pipelines', icon: 'Activity' },
      { name: 'Roles & permissions', href: '/dashboard/settings/roles', icon: 'Users' },
    ],
  },
];

export const PLATFORM_NAV: NavItem[] = [
  { name: 'SaaS Dashboard', href: '/admin', icon: 'ShieldAlert', roles: ['SUPER_ADMIN'] },
  { name: 'Companies', href: '/admin/companies', icon: 'Building2', roles: ['SUPER_ADMIN'] },
  { name: 'User Management', href: '/admin/users', icon: 'Users', roles: ['SUPER_ADMIN'] },
  { name: 'Subscriptions', href: '/admin/subscriptions', icon: 'CreditCard', roles: ['SUPER_ADMIN'] },
  { name: 'Plans', href: '/admin/plans', icon: 'CreditCard', roles: ['SUPER_ADMIN'] },
  { name: 'Email logs', href: '/admin/emails', icon: 'Mail', roles: ['SUPER_ADMIN'] },
  { name: 'Activity', href: '/admin/activity', icon: 'Activity', roles: ['SUPER_ADMIN'] },
  { name: 'Platform Settings', href: '/admin/settings', icon: 'Settings', roles: ['SUPER_ADMIN'] },
];

export function navItemsForModule(
  moduleId: WorkspaceModuleId,
  opts: {
    vertical?: string | null;
    companySlug?: string;
    userRole: string;
  }
): NavItem[] {
  const { vertical, companySlug, userRole } = opts;
  const agency = vertical === 'web_agency';

  switch (moduleId) {
    case 'home': {
      let homeItems = [
        ...MAIN_NAV.filter((i) => i.href === '/dashboard' || i.href === '/portal'),
        ...HOME_WORK_NAV,
      ];
      if (agency) {
        homeItems = homeItems.filter((i) => i.href !== '/dashboard/technician');
      }
      return homeItems;
    }
    case 'clients':
      return CLIENTS_NAV;
    case 'sales':
      return SALES_NAV;
    case 'projects': {
      let items = [...PROJECTS_NAV];
      if (!agency) {
        items = items.filter(
          (i) =>
            i.href !== '/dashboard/budgets' &&
            i.href !== '/dashboard/workflows' &&
            i.href !== '/dashboard/timesheets'
        );
      }
      return items;
    }
    case 'support': {
      if (!agency) return SUPPORT_NAV;
      // Agency: tickets + WhatsApp + support tools; hide field / contracts / service reports
      return SUPPORT_NAV.filter(
        (i) =>
          i.href !== '/dashboard/contracts' &&
          i.href !== '/dashboard/service-reports' &&
          i.name !== 'Field tools'
      );
    }
    case 'outreach':
      return OUTREACH_NAV;
    case 'people': {
      if (['ADMIN', 'SUPER_ADMIN'].includes(userRole)) return PEOPLE_ADMIN_NAV;
      if (!companySlug) return [];
      return [
        { name: 'Attendance', href: `/employee/attendance`, icon: 'Clock', roles: ['TECHNICIAN', 'SALES', 'SUPPORT_MANAGER'] },
        { name: 'Leave', href: `/employee/leave`, icon: 'Calendar', roles: ['TECHNICIAN', 'SALES', 'SUPPORT_MANAGER'] },
        { name: 'Payslips', href: `/employee/payslips`, icon: 'Wallet', roles: ['TECHNICIAN', 'SALES', 'SUPPORT_MANAGER'] },
        { name: 'My profile', href: `/employee/profile`, icon: 'User', roles: ['TECHNICIAN', 'SALES', 'SUPPORT_MANAGER'] },
      ];
    }
    case 'ops': {
      const items = [...OPS_NAV];
      if (agency) {
        return items.filter((i) => i.href !== '/dashboard/budgets');
      }
      return items;
    }
    case 'workspace': {
      const items = [...WORKSPACE_NAV];
      if (agency) {
        return items.filter((i) => i.href !== '/dashboard/workflows');
      }
      return items;
    }
    case 'platform':
      return PLATFORM_NAV;
    default:
      return [];
  }
}

export function peopleNavSectionsForRole(userRole: string): { title: string; items: NavItem[] }[] {
  if (!['ADMIN', 'SUPER_ADMIN'].includes(userRole)) return [];
  return PEOPLE_NAV_SECTIONS;
}

export type WorkspaceFeaturesMap = Record<string, boolean | undefined> | null | undefined;

/** Single source for module switcher + hub cards. */
export function getAvailableModules(opts: {
  role: string;
  vertical?: BusinessVertical | string | null;
  features?: WorkspaceFeaturesMap;
}): WorkspaceModuleDef[] {
  const { role, vertical, features } = opts;
  let mods = hubModulesForVertical(vertical);

  if (role !== 'SUPER_ADMIN') {
    mods = mods.filter((m) => m.id !== 'platform');
  }

  if (role === 'TECHNICIAN') {
    mods = mods.filter((m) => ['support', 'people', 'workspace'].includes(m.id));
  } else if (role === 'CUSTOMER') {
    mods = mods.filter((m) => m.id === 'support');
  } else if (!['ADMIN', 'SUPER_ADMIN'].includes(role)) {
    mods = mods.filter((m) => m.id !== 'platform' && m.id !== 'ops');
  }

  // Hide ops when inventory/equipment aren't enabled (always for agency)
  if (
    features &&
    features.inventory !== true &&
    features.equipment !== true
  ) {
    mods = mods.filter((m) => m.id !== 'ops');
  } else if (vertical === 'web_agency') {
    mods = mods.filter((m) => m.id !== 'ops');
  }

  return mods;
}

export type LastModuleState = {
  id: WorkspaceModuleId;
  lastHref: string;
};

export function lastModuleStorageKey(companySlug: string): string {
  return `opslane:lastModule:${companySlug || 'default'}`;
}

export function readLastModule(companySlug: string): LastModuleState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(lastModuleStorageKey(companySlug));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LastModuleState;
    if (!parsed?.id || !parsed?.lastHref) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeLastModule(companySlug: string, state: LastModuleState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(lastModuleStorageKey(companySlug), JSON.stringify(state));
  } catch {
    /* ignore quota */
  }
}

/** Prefer lastHref when it still belongs to the target module. */
export function resolveModuleSwitchHref(
  moduleId: WorkspaceModuleId,
  opts: { vertical?: string | null; companySlug: string; landingHref: string }
): string {
  const last = readLastModule(opts.companySlug);
  if (!last || last.id !== moduleId) return opts.landingHref;
  const resolved = resolveModuleId(last.lastHref, { vertical: opts.vertical });
  if (resolved === moduleId) return last.lastHref;
  return opts.landingHref;
}

/** Type-only re-export hint for LucideIcon consumers */
export type { LucideIcon };
