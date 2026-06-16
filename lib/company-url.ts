/**
 * Build a URL scoped to a company slug.
 *
 * @example
 *   getCompanyUrl('/dashboard', 'acme-corp')  // → '/acme-corp/dashboard'
 *   getCompanyUrl('settings', 'acme-corp')    // → '/acme-corp/settings'
 */
export function getCompanyUrl(path: string, companySlug: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `/${companySlug}${cleanPath}`;
}

/**
 * Map legacy `/dashboard/...` links to `/{slug}/dashboard/...` when that route exists
 * under the company-scoped app. Super admins and users without a slug keep legacy URLs.
 */
export function resolveWorkspaceDashboardHref(
  href: string,
  companySlug: string | undefined,
  userRole: string
): string {
  if (userRole === 'SUPER_ADMIN' || !companySlug) return href;
  const slug = companySlug.trim();
  if (!slug) return href;

  const qIndex = href.indexOf('?');
  const pathPart = qIndex === -1 ? href : href.slice(0, qIndex);
  const query = qIndex === -1 ? '' : href.slice(qIndex);

  if (!pathPart.startsWith('/dashboard')) return href;

  if (pathPart === '/dashboard') {
    return `/${slug}/dashboard${query}`;
  }

  if (pathPart === '/dashboard/equipment/new' || pathPart.startsWith('/dashboard/equipment')) {
    return `/${slug}/dashboard/inventory${query}`;
  }

  const tenantPrefixes = [
    '/dashboard/leads',
    '/dashboard/products',
    '/dashboard/clients',
    '/dashboard/inventory',
    '/dashboard/employees',
    '/dashboard/messages',
    '/dashboard/approve-employees',
    '/dashboard/payroll',
    '/dashboard/leave-requests',
  ] as const;
  for (const prefix of tenantPrefixes) {
    if (pathPart === prefix || pathPart.startsWith(`${prefix}/`)) {
      return `/${slug}${pathPart}${query}`;
    }
  }

  if (pathPart === '/dashboard/settings' || pathPart.startsWith('/dashboard/settings/company')) {
    return `/${slug}${pathPart}${query}`;
  }

  return href;
}

/**
 * Generate a URL-safe slug from a company name.
 *
 * @example
 *   generateSlug('Acme Corporation')  // → 'acme-corporation'
 *   generateSlug('My   Company!!')    // → 'my-company'
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')   // remove special chars
    .replace(/[\s_]+/g, '-')    // spaces/underscores → hyphens
    .replace(/-+/g, '-')        // collapse consecutive hyphens
    .replace(/^-|-$/g, '');     // trim leading/trailing hyphens
}
