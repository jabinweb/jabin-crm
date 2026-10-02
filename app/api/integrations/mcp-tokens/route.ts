import { NextResponse } from 'next/server';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';
import {
  MAX_MCP_TOKENS_PER_USER,
  countMcpTokens,
  createMcpToken,
  listMcpTokens,
} from '@/lib/mcp/token-store';
import { parseMcpTokenExpiryDays, parseMcpTokenScope } from '@/lib/mcp/token-format';

/** GET /api/integrations/mcp-tokens — the signed-in user's MCP tokens for this workspace */
export const GET = withTenantRoute(async (_request, { session, companyId }) => {
  const tokens = await listMcpTokens(session.user.id, companyId);
  return jsonOk({ tokens });
});

/**
 * POST /api/integrations/mcp-tokens { name, scope: 'read' | 'read_write', expiresInDays }
 * Returns the plain token once. Portal customers are rejected by withTenantRoute.
 */
export const POST = withTenantRoute(async (request, { session, companyId }) => {
  const body = await request.json().catch(() => ({}));
  const name =
    typeof body.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 60) : 'AI client';

  if ((await countMcpTokens(session.user.id)) >= MAX_MCP_TOKENS_PER_USER) {
    return NextResponse.json(
      { error: `You can have up to ${MAX_MCP_TOKENS_PER_USER} active tokens. Revoke one first.` },
      { status: 400 }
    );
  }

  const { token, view } = await createMcpToken({
    userId: session.user.id,
    companyId,
    name,
    scope: parseMcpTokenScope(body.scope),
    expiresInDays: parseMcpTokenExpiryDays(body.expiresInDays),
  });
  return jsonOk({ token, tokenInfo: view }, { status: 201 });
});
