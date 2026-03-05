import { auth } from "@/auth"
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { rateLimit } from './lib/rate-limit';
import { logError } from './lib/logger';

/**
 * Proxy runs on every request
 * - Handles RBAC and redirection
 * - Handles rate limiting for API routes
 * - Proxies Google Fonts requests to avoid build issues
 */
export const proxy = auth(async (req: any) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;
  const role = req.auth?.user?.role;

  // 1. RBAC & Redirection Logic
  const isPortalRoute = pathname.startsWith("/portal");
  const isDashboardRoute = pathname.startsWith("/dashboard");
  const isApiPortalRoute = pathname.startsWith("/api/portal");
  const isApiRoute = pathname.startsWith("/api");

  const isAuthRoute = pathname.startsWith("/auth") || pathname.startsWith("/api/auth");
  const isPublicRoute = pathname === "/" || pathname.startsWith("/_next") || pathname.startsWith("/static");

  if (!isAuthRoute && !isPublicRoute) {
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL("/auth/signin", req.nextUrl));
    }

    // SUPER_ADMIN has global access (SaaS Admin)
    if (role === 'SUPER_ADMIN') {
      return NextResponse.next();
    }

    if (role === 'CUSTOMER') {
      const isAllowedForCustomer = isPortalRoute || isApiPortalRoute || pathname.startsWith("/api/profile");
      if (!isAllowedForCustomer) {
        return NextResponse.redirect(new URL("/portal", req.nextUrl));
      }
    } else {
      // Staff (ADMIN, SALES, TECH)
      const isAdminRoute = pathname.startsWith("/admin");

      if (isAdminRoute) {
        // Only SUPER_ADMIN allowed on SaaS Admin routes
        return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
      }

      if (isPortalRoute && role !== 'ADMIN') {
        // Only Company ADMIN (and SUPER_ADMIN above) allowed on portal
        return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
      }
    }
  }

  // 2. Proxy Google Fonts requests
  if (pathname.startsWith('/_next/static/css') || pathname.includes('fonts.googleapis.com')) {
    try {
      if (pathname.includes('fonts.googleapis.com')) {
        return NextResponse.next();
      }
    } catch (error) {
      logError(error, { context: 'Google Fonts proxy error' });
      return NextResponse.next();
    }
  }

  // 3. Apply rate limiting to API routes
  if (isApiRoute && !isAuthRoute) {
    let rateLimitConfig = {
      windowMs: 15 * 60 * 1000,
      maxRequests: 100,
    };

    if (pathname.includes('/email/send') || pathname.includes('/campaigns')) {
      rateLimitConfig = {
        windowMs: 60 * 60 * 1000,
        maxRequests: 50,
      };
    }

    if (pathname.includes('/payment') || pathname.includes('/subscription')) {
      rateLimitConfig = {
        windowMs: 60 * 60 * 1000,
        maxRequests: 10,
      };
    }

    try {
      await rateLimit(req as any, rateLimitConfig);
    } catch (error) {
      logError(error, { context: 'Rate limiting error' });
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js|offline.html).*)',
    '/portal/:path*',
    '/dashboard/:path*',
    '/admin/:path*',
    '/api/portal/:path*',
  ],
};
