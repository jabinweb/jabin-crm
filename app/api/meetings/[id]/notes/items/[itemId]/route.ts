import { NextResponse } from 'next/server';
import { updateActionItem } from '@/lib/meetings/ai-notes/service';
import { withNotesRoute } from '@/lib/meetings/ai-notes/route';
import { meetingViewer } from '@/lib/meetings/route';

/** PATCH /api/meetings/:id/notes/items/:itemId { done } — tick an action item. */
export const PATCH = withNotesRoute(async (request, { session, companyId }, routeContext) => {
  const { id, itemId } = await routeContext.params;
  const body = (await request.json().catch(() => null)) ?? {};
  const item = await updateActionItem(id, companyId, meetingViewer(session), itemId, { done: body.done });
  return NextResponse.json({ item });
});
