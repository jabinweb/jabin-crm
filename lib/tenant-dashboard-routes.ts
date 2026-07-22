/**
 * Tenant-scoped dashboard route resolution.
 * Used by company-url (link resolution) and proxy (legacy /dashboard redirects).
 */

/** Paths that map to a different tenant route (legacy → canonical). */
export const LEGACY_DASHBOARD_ALIASES: Array<{
  match: (path: string) => boolean;
  resolve: (path: string, slug: string, query: string) => string;
}> = [
  {
    match: (p) => p === '/dashboard/equipment' || p.startsWith('/dashboard/equipment/'),
    resolve: (p, slug, query) =>
      `/${slug}/dashboard/inventory${p.slice('/dashboard/equipment'.length)}${query}`,
  },
  {
    match: (p) => p === '/dashboard/clients' || p.startsWith('/dashboard/clients/'),
    resolve: (p, slug, query) =>
      `/${slug}/dashboard/customers${p.slice('/dashboard/clients'.length)}${query}`,
  },
];

/** Explicit tenant dashboard prefixes (used for prefix matching). */
export const TENANT_DASHBOARD_PREFIXES = [
  '/dashboard/leads',
  '/dashboard/products',
  '/dashboard/customers',
  '/dashboard/inventory',
  '/dashboard/employees',
  '/dashboard/messages',
  '/dashboard/approve-employees',
  '/dashboard/payroll',
  '/dashboard/leave-requests',
  '/dashboard/support',
  '/dashboard/tickets',
  '/dashboard/contracts',
  '/dashboard/deals',
  '/dashboard/quotations',
  '/dashboard/invoices',
  '/dashboard/whatsapp',
  '/dashboard/analytics',
  '/dashboard/tasks',
  '/dashboard/team',
  '/dashboard/calendar',
  '/dashboard/duplicates',
  '/dashboard/campaigns',
  '/dashboard/reports',
  '/dashboard/email-templates',
  '/dashboard/docs',
  '/dashboard/sequences',
  '/dashboard/emails',
  '/dashboard/settings',
  '/dashboard/technician',
  '/dashboard/service-reports',
  '/dashboard/service',
] as const;

export function splitHref(href: string) {
  const qIndex = href.indexOf('?');
  return {
    pathPart: qIndex === -1 ? href : href.slice(0, qIndex),
    query: qIndex === -1 ? '' : href.slice(qIndex),
  };
}

export function scopeLegacyDashboardPath(pathPart: string, query: string, slug: string): string | null {
  if (pathPart === '/dashboard') {
    return `/${slug}/dashboard${query}`;
  }

  for (const alias of LEGACY_DASHBOARD_ALIASES) {
    if (alias.match(pathPart)) {
      return alias.resolve(pathPart, slug, query);
    }
  }

  for (const prefix of TENANT_DASHBOARD_PREFIXES) {
    if (pathPart === prefix || pathPart.startsWith(`${prefix}/`)) {
      return `/${slug}${pathPart}${query}`;
    }
  }

  // Catch-all: any other /dashboard/* legacy path gets tenant-scoped
  if (pathPart.startsWith('/dashboard/')) {
    return `/${slug}${pathPart}${query}`;
  }

  return null;
}

/** Whether a pathname should redirect from legacy /dashboard to /{slug}/dashboard. */
export function shouldRedirectLegacyDashboard(pathname: string): boolean {
  return pathname === '/dashboard' || pathname.startsWith('/dashboard/');
}

export function resolveLegacyDashboardToTenant(href: string, companySlug?: string): string {
  if (!companySlug?.trim()) return href;

  const slug = companySlug.trim();
  const { pathPart, query } = splitHref(href);

  if (!pathPart.startsWith('/dashboard')) return href;

  return scopeLegacyDashboardPath(pathPart, query, slug) ?? href;
}
