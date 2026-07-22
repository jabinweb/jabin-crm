import { companyPath, tenantDashboardHome } from '@/lib/routing/paths';

export type PostLoginUser = {
  role?: string | null;
  companySlug?: string | null;
};

/** Canonical landing URL after sign-in. */
export function resolvePostLoginPath(user: PostLoginUser): string {
  const role = user.role ?? '';
  const slug = typeof user.companySlug === 'string' ? user.companySlug.trim() : '';

  if (role === 'CUSTOMER') return '/portal';
  // Platform owners always land on the SaaS console (can open any company from there).
  if (role === 'SUPER_ADMIN') return '/admin';
  // Field staff land on their work queue, not the admin CRM home.
  if (role === 'TECHNICIAN' && slug) {
    return companyPath(slug, '/dashboard/technician');
  }
  if (slug) return tenantDashboardHome(slug);
  return '/workspace';
}

export { companyPath };
