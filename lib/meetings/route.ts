import { NextResponse, type NextRequest } from 'next/server';
import type { Session } from 'next-auth';
import { withTenantRoute, type ApiRouteContext, type RouteContext } from '@/lib/api/with-route';
import { isMeetingsSchemaMissing, MEETINGS_NOT_READY_MESSAGE } from './service';
import type { MeetingViewer } from './rules';

/**
 * Viewer for meeting rules. withTenantRoute already rejected portal customers and
 * verified membership of the requested workspace, so the caller is workspace staff.
 */
export function meetingViewer(session: Session): MeetingViewer & { name: string | null } {
  return {
    userId: session.user.id,
    role: session.user.role ?? null,
    isWorkspaceStaff: session.user.role !== 'CUSTOMER',
    name: session.user.name ?? null,
  };
}

/** Tenant route + a clear 503 while the team-meetings migration is not applied. */
export function withMeetingsRoute(
  handler: (
    request: NextRequest,
    ctx: ApiRouteContext & { companyId: string },
    routeContext: RouteContext
  ) => Promise<Response>
) {
  return withTenantRoute(async (request, ctx, routeContext) => {
    if (ctx.session.user.role === 'CUSTOMER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    try {
      return await handler(request, ctx, routeContext);
    } catch (error) {
      if (isMeetingsSchemaMissing(error)) {
        return NextResponse.json(
          { error: MEETINGS_NOT_READY_MESSAGE, code: 'MEETINGS_NOT_READY' },
          { status: 503 }
        );
      }
      throw error;
    }
  });
}
