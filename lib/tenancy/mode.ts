export type TenancyMode = 'path' | 'subdomain';

export const TENANCY_MODES: TenancyMode[] = ['path', 'subdomain'];

export function parseTenancyMode(value: unknown): TenancyMode | null {
  if (value === 'path' || value === 'subdomain') return value;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (v === 'path' || v === 'subdomain') return v;
  }
  return null;
}

/** Client + build-time default from env (defaults to path). */
export function getEnvTenancyMode(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): TenancyMode {
  return parseTenancyMode(env.NEXT_PUBLIC_TENANCY_MODE) ?? 'path';
}

export function getAppHost(appUrl?: string): string {
  const raw =
    appUrl?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    'http://localhost:3000';
  try {
    return new URL(raw.includes('://') ? raw : `https://${raw}`).host;
  } catch {
    return 'localhost:3000';
  }
}

/** Human-readable workspace address for UI copy. */
export function formatWorkspaceAddress(
  slug: string,
  mode: TenancyMode,
  appUrl?: string
): string {
  const host = getAppHost(appUrl);
  const clean = slug.trim() || 'workspace';
  return mode === 'subdomain' ? `${clean}.${host}` : `${host}/${clean}`;
}

/**
 * In-app navigation path. Always path-scoped so the Next.js app works without
 * wildcard DNS; subdomain mode mainly affects display + absolute links.
 */
export function tenantAppPath(slug: string, segment = '/dashboard'): string {
  const cleanSlug = slug.trim();
  const cleanSegment = segment.startsWith('/') ? segment : `/${segment}`;
  return `/${cleanSlug}${cleanSegment}`;
}

/** Absolute URL for emails / external redirects when subdomain mode is on. */
export function tenantAbsoluteUrl(
  slug: string,
  mode: TenancyMode,
  segment = '/dashboard',
  appUrl?: string
): string {
  const base = (appUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(
    /\/$/,
    ''
  );
  const path = segment.startsWith('/') ? segment : `/${segment}`;

  if (mode === 'subdomain') {
    try {
      const u = new URL(base);
      u.hostname = `${slug.trim()}.${u.hostname.replace(/^www\./, '')}`;
      u.pathname = path;
      return u.toString().replace(/\/$/, '') || u.origin + path;
    } catch {
      /* fall through */
    }
  }

  return `${base}${tenantAppPath(slug, path)}`;
}

export const RESERVED_SUBDOMAINS = new Set([
  'www',
  'app',
  'api',
  'admin',
  'portal',
  'auth',
  'start',
  'pricing',
  'mail',
  'status',
  'cdn',
  'static',
  'assets',
]);
