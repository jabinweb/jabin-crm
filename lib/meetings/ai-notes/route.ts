import { NextResponse, type NextRequest } from 'next/server';
import type { ApiRouteContext, RouteContext } from '@/lib/api/with-route';
import { withMeetingsRoute } from '../route';
import { isNotesSchemaMissing, NOTES_NOT_READY_MESSAGE } from './service';

/** Meetings route + a clear 503 while the AI-notes migration is not applied. */
export function withNotesRoute(
  handler: (
    request: NextRequest,
    ctx: ApiRouteContext & { companyId: string },
    routeContext: RouteContext
  ) => Promise<Response>
) {
  return withMeetingsRoute(async (request, ctx, routeContext) => {
    try {
      return await handler(request, ctx, routeContext);
    } catch (error) {
      if (isNotesSchemaMissing(error)) {
        return NextResponse.json({ error: NOTES_NOT_READY_MESSAGE, code: 'NOTES_NOT_READY' }, { status: 503 });
      }
      throw error;
    }
  });
}
