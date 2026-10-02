import { NextResponse } from 'next/server';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';
import { revokeMcpToken } from '@/lib/mcp/token-store';

/** DELETE /api/integrations/mcp-tokens/:id — revoke one of your own tokens (effective immediately) */
export const DELETE = withTenantRoute(async (_request, { session }, routeContext) => {
  const id = (await routeContext!.params).id;
  const revoked = await revokeMcpToken(session.user.id, id);
  if (!revoked) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return jsonOk({ ok: true });
});
