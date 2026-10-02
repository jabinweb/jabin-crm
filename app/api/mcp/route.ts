import { NextResponse, type NextRequest } from 'next/server';
import { consumeRateLimit } from '@/lib/rate-limit-store';
import { bearerTokenFromHeader } from '@/lib/mcp/token-format';
import { resolveMcpToken } from '@/lib/mcp/token-store';
import { JSON_RPC_ERRORS, handleMcpPayload } from '@/lib/mcp/json-rpc';
import { createWorkspaceMcpDeps, resolveMcpPrincipal } from '@/lib/mcp/workspace-server';

/**
 * Opslane remote MCP server (Streamable HTTP, stateless, JSON responses).
 *
 * Auth: `Authorization: Bearer opl_…` personal token created under
 * Settings → Personal CRM settings → AI clients (MCP). No session cookie is used —
 * proxy.ts lets this path through and everything is checked here.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Per-token budget, on top of the proxy's per-IP API limit */
const RATE_LIMIT = { windowMs: 60_000, maxRequests: 120 };
const MAX_BODY_BYTES = 1_000_000;

function jsonRpcError(status: number, code: number, message: string, headers?: HeadersInit) {
  return NextResponse.json({ jsonrpc: '2.0', id: null, error: { code, message } }, { status, headers });
}

function unauthorized(message: string) {
  return jsonRpcError(401, JSON_RPC_ERRORS.INVALID_REQUEST, message, {
    'WWW-Authenticate': 'Bearer realm="opslane-mcp", error="invalid_token"',
  });
}

function clientIp(req: NextRequest) {
  return (
    req.headers.get('cf-connecting-ip')?.trim() ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    null
  );
}

export async function POST(req: NextRequest) {
  const raw = bearerTokenFromHeader(req.headers.get('authorization'));
  if (!raw) {
    return unauthorized(
      'Missing token. Create one in Opslane under Settings → Personal CRM settings → AI clients (MCP) and send it as "Authorization: Bearer <token>".'
    );
  }

  const token = await resolveMcpToken(raw, clientIp(req));
  if (!token) return unauthorized('Invalid, expired or revoked token');

  if (!(await consumeRateLimit(`mcp:${token.tokenId}`, RATE_LIMIT))) {
    return jsonRpcError(429, JSON_RPC_ERRORS.INTERNAL_ERROR, 'Too many requests — slow down', {
      'Retry-After': '60',
    });
  }

  const principal = await resolveMcpPrincipal(token);
  if (!principal) {
    return jsonRpcError(
      403,
      JSON_RPC_ERRORS.INVALID_REQUEST,
      'This token no longer has access to its workspace'
    );
  }

  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) {
    return jsonRpcError(413, JSON_RPC_ERRORS.INVALID_REQUEST, 'Request too large');
  }
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    return jsonRpcError(400, JSON_RPC_ERRORS.PARSE_ERROR, 'Parse error');
  }

  const response = await handleMcpPayload(payload, createWorkspaceMcpDeps(principal));
  // Only notifications / client responses: acknowledge without a body
  if (response === null) return new NextResponse(null, { status: 202 });
  return NextResponse.json(response, { headers: { 'Cache-Control': 'no-store' } });
}

/**
 * Stateless server: no server-initiated SSE stream and no sessions to end. The spec lets
 * a server answer both with 405.
 */
function methodNotAllowed() {
  return new NextResponse(null, { status: 405, headers: { Allow: 'POST' } });
}

export async function GET() {
  return methodNotAllowed();
}

export async function DELETE() {
  return methodNotAllowed();
}
