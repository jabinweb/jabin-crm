import { NextResponse } from 'next/server';
import { TenantError } from '@/lib/auth/company-membership';
import { handleApiError } from '@/lib/api-error-handler';

/** Standard JSON response for {@link TenantError} from company-membership helpers. */
export function tenantErrorResponse(err: TenantError): NextResponse {
  return NextResponse.json(
    { error: err.message, ...(err.code ? { code: err.code } : {}) },
    { status: err.status }
  );
}

/** Handle tenant errors with the shared API error handler. */
export function handleRouteError(error: unknown, context?: Record<string, unknown>): NextResponse {
  if (error instanceof TenantError) return tenantErrorResponse(error);
  return handleApiError(error, context);
}
