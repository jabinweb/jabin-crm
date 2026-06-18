import { resolveLegacyDashboardToTenant } from '@/lib/tenant-dashboard-routes';
import { companyPath } from '@/lib/routing/paths';

/** Build a URL scoped to a company slug. Dashboard paths are canonicalized. */
export function getCompanyUrl(path: string, companySlug: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (cleanPath.startsWith('/dashboard')) {
    return resolveLegacyDashboardToTenant(cleanPath, companySlug);
  }
  return companyPath(companySlug, cleanPath);
}

/** Map dashboard-relative paths to `/{slug}/dashboard/...` when a slug is present. */
export function resolveTenantDashboardPath(href: string, companySlug?: string): string {
  return resolveLegacyDashboardToTenant(href, companySlug);
}

/**
 * Map dashboard-relative paths for sidebar navigation.
 * Logical paths like `/dashboard/leads` resolve to tenant URLs when a slug is present.
 */
export function resolveWorkspaceDashboardHref(
  href: string,
  companySlug: string | undefined,
  userRole: string
): string {
  if (userRole === 'SUPER_ADMIN' && !companySlug?.trim()) {
    return href === '/dashboard' ? '/admin' : href;
  }
  if (!companySlug?.trim()) return href;
  return resolveLegacyDashboardToTenant(href, companySlug);
}

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
