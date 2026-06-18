import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { Session } from 'next-auth';
import { auth } from '@/auth';
import {
  resolveCompanyContextFromRequest,
  TenantError,
} from '@/lib/auth/company-membership';
import { ApiErrors } from '@/lib/api-error-handler';
import { hasLegacyRole } from '@/lib/auth/permissions';
import { handleRouteError } from '@/lib/api/tenant-response';
import { resolveStaffCompanyScope } from '@/lib/tenant/scope-staff-query';

export type RouteContext = { params: Promise<Record<string, string>> };

export type RouteAuth = 'public' | 'session' | 'tenant' | 'tenant-optional' | 'admin';

export type ApiRouteContext = {
  session: Session;
  companyId?: string;
  userId: string;
  employeeId?: string;
};

type Handler = (
  request: NextRequest,
  ctx: ApiRouteContext,
  routeContext?: RouteContext
) => Promise<Response | NextResponse>;

/**
 * Standard API route wrapper: auth → tenant context → handler → unified errors.
 *
 * @example
 * export const GET = withApiRoute({ auth: 'tenant', handler: async (req, { companyId }) => { ... } });
 */
export function withApiRoute(options: {
  auth?: RouteAuth;
  handler: Handler;
}) {
  const authMode = options.auth ?? 'session';

  return async (request: NextRequest, routeContext?: RouteContext): Promise<Response> => {
    try {
      let session: Session | null = null;
      let companyId: string | undefined;

      if (authMode !== 'public') {
        session = await auth();
        if (!session?.user?.id) throw ApiErrors.unauthorized();

        if (authMode === 'admin') {
          if (!hasLegacyRole(session as Session, 'ADMIN', 'SUPER_ADMIN')) {
            throw ApiErrors.forbidden();
          }
        }

        if (authMode === 'tenant') {
          const tenant = await resolveCompanyContextFromRequest(session, request);
          companyId = tenant.companyId;
        }

        if (authMode === 'tenant-optional') {
          try {
            const tenant = await resolveCompanyContextFromRequest(session, request);
            companyId = tenant.companyId;
          } catch (e) {
            if (!(e instanceof TenantError) || e.status !== 400) throw e;
          }
        }
      }

      const result = await options.handler(
        request,
        {
          session: session as Session,
          companyId,
          userId: session?.user?.id ?? '',
          employeeId:
            typeof (session?.user as { employeeId?: string })?.employeeId === 'string'
              ? (session!.user as { employeeId?: string }).employeeId
              : undefined,
        },
        routeContext
      );

      return result;
    } catch (error) {
      if (error instanceof TenantError) {
        return handleRouteError(error);
      }
      const response = handleRouteError(error, { path: request.nextUrl.pathname });
      return response;
    }
  };
}

/** JSON helper for route handlers. */
export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export type StaffRouteContext = ApiRouteContext & {
  companyId: string | undefined;
};

/** Staff CRM routes with optional global scope for SUPER_ADMIN. */
export function withStaffRoute(
  handler: (
    request: NextRequest,
    ctx: StaffRouteContext,
    routeContext?: RouteContext
  ) => Promise<Response | NextResponse>
) {
  return async (request: NextRequest, routeContext?: RouteContext): Promise<Response> => {
    try {
      const session = await auth();
      if (!session?.user?.id) throw ApiErrors.unauthorized();

      const companyId = await resolveStaffCompanyScope(session, request, {
        allowGlobalForSuperAdmin: true,
      });

      return await handler(
        request,
        {
          session: session as Session,
          companyId: companyId ?? undefined,
          userId: session.user.id,
          employeeId:
            typeof session.user.employeeId === 'string' ? session.user.employeeId : undefined,
        },
        routeContext
      );
    } catch (error) {
      return handleRouteError(error, { path: request.nextUrl.pathname });
    }
  };
}

export const withTenantRoute = (
  handler: (
    request: NextRequest,
    ctx: ApiRouteContext & { companyId: string },
    routeContext?: RouteContext
  ) => Promise<Response | NextResponse>
) =>
  withApiRoute({
    auth: 'tenant',
    handler: (req, ctx, routeCtx) =>
      handler(req, ctx as ApiRouteContext & { companyId: string }, routeCtx),
  });

export const withSessionRoute = (
  handler: (
    request: NextRequest,
    ctx: ApiRouteContext,
    routeContext?: RouteContext
  ) => Promise<Response | NextResponse>
) => withApiRoute({ auth: 'session', handler });
