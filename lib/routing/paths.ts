import { resolveLegacyDashboardToTenant } from '@/lib/tenant-dashboard-routes';

/** Build `/{slug}{segment}` with a single leading slash on the segment. */
export function companyPath(slug: string, segment: string): string {
  const cleanSlug = slug.trim();
  const cleanSegment = segment.startsWith('/') ? segment : `/${segment}`;
  return `/${cleanSlug}${cleanSegment}`;
}

/**
 * Resolve a dashboard-relative path (e.g. `/dashboard/leads`) to a tenant URL.
 * Unscoped callers receive the logical path unchanged (proxy resolves on navigation).
 */
export function tenantDashboardPath(slug: string | undefined, dashboardPath: string): string {
  if (!slug?.trim()) return dashboardPath;
  return resolveLegacyDashboardToTenant(dashboardPath, slug.trim());
}

/**
 * Resolve an employee-relative path (e.g. `/employee/dashboard`) to a tenant URL.
 */
export function tenantEmployeePath(slug: string | undefined, employeePath: string): string {
  const normalized = employeePath.startsWith('/') ? employeePath : `/${employeePath}`;
  if (!slug?.trim()) return normalized;
  if (normalized.startsWith(`/${slug.trim()}/`)) return normalized;
  if (normalized.startsWith('/employee')) {
    return companyPath(slug, normalized);
  }
  return companyPath(slug, `/employee${normalized}`);
}

/** Canonical dashboard home for a tenant. */
export function tenantDashboardHome(slug: string): string {
  return companyPath(slug, '/dashboard');
}

/** Canonical employee portal home for a tenant. */
export function tenantEmployeeHome(slug: string): string {
  return companyPath(slug, '/employee/dashboard');
}
