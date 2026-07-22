/**
 * Env-driven branding — use server-side in emails/API routes.
 */
import { getAppBaseUrl } from '@/lib/app-url';

export function getBrandConfig() {
  const appName = process.env.NEXT_PUBLIC_APP_NAME?.trim() || 'Opslane';
  const appUrl = getAppBaseUrl();

  return {
    appName,
    supportTeamName:
      process.env.NEXT_PUBLIC_SUPPORT_TEAM_NAME?.trim() || `${appName} Support`,
    systemName: process.env.NEXT_PUBLIC_SYSTEM_NAME?.trim() || `${appName} System`,
    appUrl,
    logoUrl: process.env.NEXT_PUBLIC_APP_LOGO_URL?.trim() || null,
    primaryColor: process.env.NEXT_PUBLIC_BRAND_PRIMARY?.trim() || '#0f766e',
  };
}

/** Client-safe branding (NEXT_PUBLIC_* only). */
export function getClientBrandConfig() {
  const appName =
    (typeof window !== 'undefined'
      ? process.env.NEXT_PUBLIC_APP_NAME
      : process.env.NEXT_PUBLIC_APP_NAME)?.trim() || 'Opslane';

  return {
    appName,
    supportTeamName:
      process.env.NEXT_PUBLIC_SUPPORT_TEAM_NAME?.trim() || `${appName} Support`,
    appUrl: process.env.NEXT_PUBLIC_APP_URL?.trim() || '',
    logoUrl: process.env.NEXT_PUBLIC_APP_LOGO_URL?.trim() || null,
    primaryColor: process.env.NEXT_PUBLIC_BRAND_PRIMARY?.trim() || '#0f766e',
  };
}
