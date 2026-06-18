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
  if (role === 'SUPER_ADMIN' && !slug) return '/admin';
  if (slug) return tenantDashboardHome(slug);
  return '/workspace';
}

export { companyPath };
