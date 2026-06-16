import type { NextRequest } from 'next/server';

export type GeoSource = 'header' | 'cookie' | 'query' | 'default';

export type RequestLocation = {
  countryCode: string;
  source: GeoSource;
};

const COUNTRY_COOKIE = 'pricing_country';

/** Normalize to ISO 3166-1 alpha-2 or null if invalid. */
export function normalizeCountryCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const code = raw.trim().toUpperCase();
  if (code === 'XX' || code === 'T1') return null;
  if (!/^[A-Z]{2}$/.test(code)) return null;
  return code;
}

/**
 * Resolve visitor country from platform geo headers, cookie override, or dev query param.
 * Priority: explicit query (non-prod) > cookie > platform headers > default (IN).
 */
export function getRequestLocation(req: NextRequest): RequestLocation {
  const queryCountry = normalizeCountryCode(req.nextUrl.searchParams.get('country'));
  if (queryCountry && process.env.NODE_ENV !== 'production') {
    return { countryCode: queryCountry, source: 'query' };
  }

  const cookieCountry = normalizeCountryCode(req.cookies.get(COUNTRY_COOKIE)?.value);
  if (cookieCountry) {
    return { countryCode: cookieCountry, source: 'cookie' };
  }

  const headerCountry = normalizeCountryCode(
    req.headers.get('x-geo-country') ||
      req.headers.get('x-vercel-ip-country') ||
      req.headers.get('cf-ipcountry')
  );
  if (headerCountry) {
    return { countryCode: headerCountry, source: 'header' };
  }

  const defaultCountry = normalizeCountryCode(process.env.PPP_DEFAULT_COUNTRY) ?? 'IN';
  return { countryCode: defaultCountry, source: 'default' };
}

export { COUNTRY_COOKIE };
