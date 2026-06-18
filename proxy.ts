import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { rateLimit } from './lib/rate-limit';
import { logError } from './lib/logger';
import { stripAuthSessionCookiesFromRequest } from '@/lib/auth/session-cookies';
import {
  resolveLegacyDashboardToTenant,
  shouldRedirectLegacyDashboard,
} from '@/lib/tenant-dashboard-routes';
import { resolvePostLoginPath } from '@/lib/auth/post-login-path';

const PUBLIC_PREFIXES = [
  '/auth',
  '/api/auth',
  '/register',
  '/api/webhooks',
  '/api/uploadthing',
  '/api/payment/callback',
];

const PUBLIC_EXACT = new Set(['/', '/pricing', '/favicon.ico', '/manifest.json', '/sw.js', '/offline.html']);

function isPublicPath(pathname: string) {
  if (PUBLIC_EXACT.has(pathname)) return true;
  if (pathname.startsWith('/payment/')) return true;
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  if (/^\/[^/]+\/register\/?$/.test(pathname)) return true;
  if (/^\/[^/]+\/employee\/register\/?$/.test(pathname)) return true;
  return false;
}

function isStaticAsset(pathname: string) {
  return (
    pathname.startsWith('/_next/static') ||
    pathname.startsWith('/_next/image') ||
    pathname.startsWith('/icons') ||
    pathname.startsWith('/static') ||
    pathname.startsWith('/.well-known')
  );
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // --- Hard stops (must run first) ---

  // Old Sentry clients POST here — never redirect, never auth-check.
  if (pathname === '/monitoring' || pathname.startsWith('/monitoring/')) {
    return new NextResponse(null, { status: 204 });
  }

  // Page routes reject POST — convert to GET sign-in.
  if (pathname === '/auth/signin' && req.method === 'POST') {
    return NextResponse.redirect(new URL('/auth/signin', req.url), 303);
  }

  if (isStaticAsset(pathname)) {
    return NextResponse.next();
  }

  // Google OAuth callback: ignore any stale session cookie.
  if (req.method === 'GET' && pathname.startsWith('/api/auth/callback/google')) {
    return NextResponse.next({
      request: { headers: stripAuthSessionCookiesFromRequest(req) },
    });
  }

  // --- Auth gate ---

  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
    secureCookie: process.env.NODE_ENV === 'production',
  });
  const isLoggedIn = !!token;
  const user = token as Record<string, unknown>;
  const role = user?.role as string | undefined;

  const isCompanyScopedRegister =
    /^\/[^/]+\/register\/?$/.test(pathname) ||
    /^\/[^/]+\/employee\/register\/?$/.test(pathname);

  if (isLoggedIn && isCompanyScopedRegister) {
    const companySlug =
      typeof user?.companySlug === 'string' ? user.companySlug.trim() : '';
    const employeeId =
      typeof user?.employeeId === 'string' ? user.employeeId.trim() : '';

    if (role === 'SUPER_ADMIN') {
      return NextResponse.redirect(new URL('/admin', req.nextUrl));
    }
    if (/^\/[^/]+\/employee\/register\/?$/i.test(pathname) && companySlug && employeeId) {
      return NextResponse.redirect(new URL(`/${companySlug}/employee/dashboard`, req.nextUrl));
    }
    if (companySlug) {
      return NextResponse.redirect(new URL(`/${companySlug}/dashboard`, req.nextUrl));
    }
  }

  if (!isPublicPath(pathname) && !isLoggedIn) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const loginUrl = new URL('/auth/signin', req.nextUrl);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl, 303);
  }

  if (isLoggedIn) {
    const companySlug =
      typeof user?.companySlug === 'string' ? user.companySlug.trim() : '';

    if (role === 'CUSTOMER' && shouldRedirectLegacyDashboard(pathname)) {
      return NextResponse.redirect(new URL('/portal', req.nextUrl));
    }

    if (companySlug && shouldRedirectLegacyDashboard(pathname)) {
      const target = resolveLegacyDashboardToTenant(pathname, companySlug);
      if (target !== pathname) {
        return NextResponse.redirect(new URL(target, req.nextUrl));
      }
    }

    if (shouldRedirectLegacyDashboard(pathname)) {
      const fallback = resolvePostLoginPath({
        role,
        companySlug,
      });
      if (fallback !== pathname) {
        return NextResponse.redirect(new URL(fallback, req.nextUrl));
      }
    }

    if (pathname.startsWith('/admin') && role !== 'SUPER_ADMIN') {
      const fallback = resolvePostLoginPath({ role, companySlug });
      return NextResponse.redirect(new URL(fallback, req.nextUrl));
    }
    const canUsePortal =
      role === 'CUSTOMER' || role === 'ADMIN' || role === 'SUPER_ADMIN';
    if (pathname.startsWith('/portal') && !canUsePortal) {
      const fallback = resolvePostLoginPath({ role, companySlug });
      return NextResponse.redirect(new URL(fallback, req.nextUrl));
    }
  }

  // --- Rate limit APIs in production ---

  if (
    pathname.startsWith('/api') &&
    !pathname.startsWith('/api/auth') &&
    process.env.NODE_ENV === 'production'
  ) {
    let rateLimitConfig = { windowMs: 15 * 60 * 1000, maxRequests: 100 };
    if (pathname.includes('/email/send') || pathname.includes('/campaigns')) {
      rateLimitConfig = { windowMs: 60 * 60 * 1000, maxRequests: 50 };
    }
    if (pathname.includes('/payment') || pathname.includes('/subscription')) {
      rateLimitConfig = { windowMs: 60 * 60 * 1000, maxRequests: 10 };
    }
    try {
      await rateLimit(req as NextRequest, rateLimitConfig);
    } catch (error) {
      if (error instanceof Error && error.message === 'Rate limit exceeded') {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
      }
      logError(error, { context: 'Rate limiting error' });
    }
  }

  // --- Pass through with context headers ---

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-pathname', pathname);

  const geoCountry =
    req.headers.get('x-vercel-ip-country') ||
    req.headers.get('cf-ipcountry') ||
    req.cookies.get('pricing_country')?.value;
  if (geoCountry) {
    requestHeaders.set('x-geo-country', geoCountry.toUpperCase());
  }

  if (isLoggedIn) {
    requestHeaders.set('x-user-id', String(user?.id ?? ''));
    requestHeaders.set('x-user-role', role ?? '');
    if (user?.companyId) requestHeaders.set('x-company-id', String(user.companyId));
    if (user?.companySlug) requestHeaders.set('x-company-slug', String(user.companySlug));
    if (user?.employeeId) requestHeaders.set('x-employee-id', String(user.employeeId));
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons/|static/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
