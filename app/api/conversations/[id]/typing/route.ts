import { NextResponse } from 'next/server';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';
import { publishRealtimeTo } from '@/lib/realtime/hub';
import { REALTIME_EVENTS } from '@/lib/realtime/events';
import { loadMembership, memberIdsOf } from '@/lib/messaging/service';

/** POST — "I'm typing" ping, delivered to the other members only. */
export const POST = withTenantRoute(async (_request, { session, companyId }, routeContext) => {
  const id = (await routeContext!.params).id;
  const access = await loadMembership(companyId, id, session.user.id);
  if (!access) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const audience = (await memberIdsOf(id)).filter((u) => u !== session.user.id);
  await publishRealtimeTo(
    REALTIME_EVENTS.CONVERSATION_TYPING,
    companyId,
    audience,
    {
      conversationId: id,
      userId: session.user.id,
      name: session.user.name || session.user.email || 'Someone',
    },
    session.user.id
  ).catch(() => undefined);
  return jsonOk({ ok: true });
});
