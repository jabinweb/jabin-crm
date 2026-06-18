import { NextRequest } from 'next/server';
import type { Session } from 'next-auth';
import { auth } from '@/auth';
import { ApiErrors } from './api-error-handler';
import {
  resolveCompanyContextFromRequest,
  TenantError,
} from './auth/company-membership';
import { hasLegacyRole, requirePermission } from './auth/permissions';

export type { TenantError };

/**
 * Require authentication for API routes.
 * @throws ApiException (401) when unauthenticated
 */
export async function requireAuth(_request?: NextRequest): Promise<Session> {
  const session = await auth();

  if (!session?.user?.id) {
    throw ApiErrors.unauthorized();
  }

  return session;
}

/**
 * Require admin role (legacy ADMIN/SUPER_ADMIN or RBAC admin:access).
 */
export async function requireAdmin(request?: NextRequest): Promise<Session> {
  const session = await requireAuth(request);

  if (hasLegacyRole(session as Session, 'ADMIN', 'SUPER_ADMIN')) return session;

  await requirePermission(session as Session, 'admin:access');

  return session;
}

/**
 * Require authenticated user with resolved tenant company context.
 * @throws TenantError or ApiException
 */
export async function requireTenantContext(request: NextRequest) {
  const session = await requireAuth(request);
  return resolveCompanyContextFromRequest(session, request);
}

/**
 * Optional tenant context — returns undefined company when not scoped (e.g. super-admin).
 */
export async function optionalTenantContext(request: NextRequest) {
  const session = await requireAuth(request);
  try {
    return await resolveCompanyContextFromRequest(session, request);
  } catch (e) {
    if (e instanceof TenantError && e.status === 400) {
      return { session, companyId: undefined as string | undefined };
    }
    throw e;
  }
}

/**
 * Check if user owns the resource.
 */
export async function requireOwnership(
  request: NextRequest,
  resourceUserId: string
): Promise<Session> {
  const session = await requireAuth(request);

  if (hasLegacyRole(session as Session, 'ADMIN', 'SUPER_ADMIN')) {
    return session;
  }

  if (session.user.id !== resourceUserId) {
    throw ApiErrors.forbidden();
  }

  return session;
}

/**
 * Optional authentication — returns null when unauthenticated.
 */
export async function optionalAuth(_request?: NextRequest) {
  const session = await auth();
  return session ?? null;
}

/** @deprecated Use {@link requireAdmin} */
export { requireAdmin as requireAdminRole };
