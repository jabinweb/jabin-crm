import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from "next-auth/jwt";
import { rateLimit } from './lib/rate-limit';
import { logError } from './lib/logger';

/**
 * Proxy runs on every request
 * - Handles RBAC and redirection
 * - Handles rate limiting for API routes
 * - Proxies Google Fonts requests to avoid build issues
 * - Injects context headers for Company Management
 */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Omit `export const config` in `proxy.ts`: exporting it triggers a Turbopack error
  // ("Could not parse module …/middleware.ts"). Skip static assets here instead.
  if (
    pathname.startsWith('/_next/static') ||
    pathname.startsWith('/_next/image') ||
    pathname === '/favicon.ico' ||
    pathname.startsWith('/icons') ||
    pathname === '/manifest.json' ||
    pathname === '/sw.js' ||
    pathname === '/offline.html' ||
    pathname.startsWith('/.well-known')
  ) {
    return NextResponse.next();
  }

  const token = await getToken({ req, secret: process.env.AUTH_SECRET });
  const isLoggedIn = !!token;
  const user = token as any;
  const role = user?.role;

  // Public signup under a chosen workspace slug (company may not exist / not approved yet)
  const isCompanyScopedRegister =
    /^\/[^/]+\/register\/?$/.test(pathname) ||
    /^\/[^/]+\/employee\/register\/?$/.test(pathname)

  // Logged-in users who already have a workspace should not see signup again.
  // Users with no companySlug (e.g. after "Continue to registration" from NO_COMPANY) must stay on /{slug}/register.
  if (isLoggedIn && isCompanyScopedRegister) {
    if (role === 'SUPER_ADMIN') {
      return NextResponse.redirect(new URL('/dashboard', req.nextUrl));
    }
    const companySlugFromUser =
      typeof user?.companySlug === 'string' ? user.companySlug.trim() : '';
    const employeeId =
      typeof user?.employeeId === 'string' ? user.employeeId.trim() : '';

    if (/^\/[^/]+\/employee\/register\/?$/i.test(pathname)) {
      if (companySlugFromUser && employeeId) {
        return NextResponse.redirect(
          new URL(`/${companySlugFromUser}/employee/dashboard`, req.nextUrl)
        );
      }
      if (companySlugFromUser) {
        return NextResponse.redirect(
          new URL(`/${companySlugFromUser}/dashboard`, req.nextUrl)
        );
      }
    } else if (/^\/[^/]+\/register\/?$/i.test(pathname)) {
      if (companySlugFromUser) {
        return NextResponse.redirect(
          new URL(`/${companySlugFromUser}/dashboard`, req.nextUrl)
        );
      }
    }
  }

  // 1. Skip Auth for static and public routes
  const isAuthRoute =
    pathname.startsWith("/auth") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/register") ||
    isCompanyScopedRegister
  const isPublicRoute =
    pathname === "/" ||
    pathname === "/pricing" ||
    pathname.startsWith("/payment/") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.startsWith("/icons") ||
    pathname.startsWith("/.well-known") ||
    isCompanyScopedRegister
  
  // Also skip logic for webhooks, payment callback, and public endpoints
  if (
    pathname.startsWith('/api/webhooks') ||
    pathname.startsWith('/api/uploadthing') ||
    pathname.startsWith('/api/payment/callback')
  ) {
    return NextResponse.next();
  }

  // 2. Google Fonts proxy workaround (non-`/_next/static` paths only; static is skipped above)
  if (pathname.includes('fonts.googleapis.com')) {
    try {
      return NextResponse.next();
    } catch (error) {
      logError(error, { context: 'Google Fonts proxy error' });
      return NextResponse.next();
    }
  }

  // 3. RBAC & Redirection Logic
  if (!isAuthRoute && !isPublicRoute) {
    if (!isLoggedIn) {
      const loginUrl = new URL("/auth/signin", req.nextUrl);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Prefer tenant URL when the user has a primary workspace (single dashboard entry)
    const companySlug = typeof user?.companySlug === "string" ? user.companySlug.trim() : ""
    if (companySlug && pathname === "/dashboard" && role !== "SUPER_ADMIN") {
      return NextResponse.redirect(new URL(`/${companySlug}/dashboard`, req.nextUrl));
    }

    // Role-based top level routing
    if (pathname.startsWith('/admin') && role !== 'SUPER_ADMIN') {
      return NextResponse.redirect(new URL('/dashboard', req.nextUrl));
    }

    // Match app/portal/layout.tsx: customer portal + admins who need to preview/support it
    const canUsePortal =
      role === "CUSTOMER" ||
      role === "ADMIN" ||
      role === "SUPER_ADMIN";
    if (pathname.startsWith("/portal") && !canUsePortal) {
      return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
    }
  }

  // 4. Rate Limiting for APIs (disabled in dev — in-memory limiter shares one bucket per IP and breaks RSC/hot reload)
  const isApiRoute = pathname.startsWith("/api");
  if (
    isApiRoute &&
    !isAuthRoute &&
    process.env.NODE_ENV === "production"
  ) {
    let rateLimitConfig = {
      windowMs: 15 * 60 * 1000,
      maxRequests: 100,
    };

    if (pathname.includes('/email/send') || pathname.includes('/campaigns')) {
      rateLimitConfig = { windowMs: 60 * 60 * 1000, maxRequests: 50 };
    }

    if (pathname.includes('/payment') || pathname.includes('/subscription')) {
      rateLimitConfig = { windowMs: 60 * 60 * 1000, maxRequests: 10 };
    }

    try {
      await rateLimit(req as any, rateLimitConfig);
    } catch (error) {
      if (error instanceof Error && error.message === 'Rate limit exceeded') {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
      }
      logError(error, { context: 'Rate limiting error' });
    }
  }

  // 5. Inject User & Company Headers for downstream API and Layout consumption
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-pathname', pathname);

  const geoCountry =
    req.headers.get('x-vercel-ip-country') ||
    req.headers.get('cf-ipcountry') ||
    req.cookies.get('pricing_country')?.value;
  if (geoCountry) {
    requestHeaders.set('x-geo-country', geoCountry.toUpperCase());
  }

  if (isLoggedIn && user) {
    requestHeaders.set('x-user-id', user.id || '');
    requestHeaders.set('x-user-role', role || '');
    if (user.companyId) requestHeaders.set('x-company-id', user.companyId);
    if (user.companySlug) requestHeaders.set('x-company-slug', user.companySlug);
    if (user.employeeId) requestHeaders.set('x-employee-id', user.employeeId);
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}
