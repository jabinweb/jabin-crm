/**
 * Env-driven branding — use server-side in emails/API routes.
 */
export function getBrandConfig() {
  const appName = process.env.NEXT_PUBLIC_APP_NAME?.trim() || 'CRM';
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.AUTH_URL?.trim() ||
    'http://localhost:3000';

  return {
    appName,
    supportTeamName:
      process.env.NEXT_PUBLIC_SUPPORT_TEAM_NAME?.trim() || `${appName} Support`,
    systemName: process.env.NEXT_PUBLIC_SYSTEM_NAME?.trim() || `${appName} System`,
    appUrl,
    logoUrl: process.env.NEXT_PUBLIC_APP_LOGO_URL?.trim() || null,
    primaryColor: process.env.NEXT_PUBLIC_BRAND_PRIMARY?.trim() || '#2563eb',
  };
}

/** Client-safe branding (NEXT_PUBLIC_* only). */
export function getClientBrandConfig() {
  const appName =
    (typeof window !== 'undefined'
      ? process.env.NEXT_PUBLIC_APP_NAME
      : process.env.NEXT_PUBLIC_APP_NAME) || 'CRM';

  return {
    appName,
    supportTeamName:
      process.env.NEXT_PUBLIC_SUPPORT_TEAM_NAME?.trim() || `${appName} Support`,
    appUrl: process.env.NEXT_PUBLIC_APP_URL?.trim() || '',
    logoUrl: process.env.NEXT_PUBLIC_APP_LOGO_URL?.trim() || null,
    primaryColor: process.env.NEXT_PUBLIC_BRAND_PRIMARY?.trim() || '#2563eb',
  };
}
