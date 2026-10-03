import { NextResponse } from 'next/server';
import { convertActionItem } from '@/lib/meetings/ai-notes/service';
import { withNotesRoute } from '@/lib/meetings/ai-notes/route';

/**
 * POST /api/meetings/:id/notes/items/:itemId/convert { kind: 'follow-up' | 'project-task', projectId? }
 * Creates a follow-up (assigned to the item's owner) or a project task and links it to the item.
 */
export const POST = withNotesRoute(async (request, { session, companyId }, routeContext) => {
  const { id, itemId } = await routeContext.params;
  const body = (await request.json().catch(() => null)) ?? {};
  if (body.kind !== 'follow-up' && body.kind !== 'project-task') {
    return NextResponse.json({ error: 'kind must be follow-up or project-task' }, { status: 400 });
  }
  const result = await convertActionItem({
    meetingId: id,
    companyId,
    session,
    itemId,
    kind: body.kind,
    projectId: typeof body.projectId === 'string' ? body.projectId : null,
  });
  return NextResponse.json(result, { status: 201 });
});
