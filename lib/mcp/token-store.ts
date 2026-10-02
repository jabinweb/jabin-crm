import { prisma } from '@/lib/prisma';
import {
  formatMcpToken,
  generateMcpSecret,
  hashMcpSecret,
  mcpTokenHint,
  parseMcpToken,
  verifyMcpSecret,
  type McpTokenScope,
} from '@/lib/mcp/token-format';

/**
 * Storage adapter for MCP access tokens.
 *
 * Tokens live in the existing `UserSession` table (no schema change needed): it is keyed
 * by user, has `expiresAt` / `isValid` / `lastActive` / `ipAddress`, a JSON `metadata`
 * column, is already cleared when an admin deletes the user or the company is deleted, and
 * the `cleanup-sessions` job already purges expired / invalid rows. Nothing else in the app
 * writes to it. Rows are told apart by `metadata.kind === 'mcp_token'`.
 *
 * Everything that touches the table goes through this file, so moving to a dedicated
 * `ApiToken` model later only means rewriting these functions.
 */
const KIND = 'mcp_token';
/** userAgent column marker so the rows are recognisable in the DB */
const USER_AGENT = 'opslane-mcp-token';
/** Don't write `lastActive` on every request */
const TOUCH_INTERVAL_MS = 60_000;
export const MAX_MCP_TOKENS_PER_USER = 20;

type TokenMetadata = {
  kind: typeof KIND;
  name: string;
  companyId: string;
  scope: McpTokenScope;
  tokenHash: string;
  hint: string;
};

export type McpTokenView = {
  id: string;
  name: string;
  scope: McpTokenScope;
  hint: string;
  createdAt: string;
  expiresAt: string;
  lastUsedAt: string | null;
};

export type ResolvedMcpToken = {
  tokenId: string;
  userId: string;
  companyId: string;
  scope: McpTokenScope;
};

type Row = {
  id: string;
  userId: string;
  expiresAt: Date;
  lastActive: Date;
  isValid: boolean;
  metadata: unknown;
  createdAt: Date;
};

function readMetadata(value: unknown): TokenMetadata | null {
  if (!value || typeof value !== 'object') return null;
  const m = value as Record<string, unknown>;
  if (m.kind !== KIND) return null;
  if (typeof m.companyId !== 'string' || typeof m.tokenHash !== 'string') return null;
  return {
    kind: KIND,
    name: typeof m.name === 'string' ? m.name : 'MCP token',
    companyId: m.companyId,
    scope: m.scope === 'read_write' ? 'read_write' : 'read',
    tokenHash: m.tokenHash,
    hint: typeof m.hint === 'string' ? m.hint : 'opl_…',
  };
}

function toView(row: Row, meta: TokenMetadata): McpTokenView {
  // lastActive starts equal to createdAt; only report real use
  const used = row.lastActive.getTime() - row.createdAt.getTime() > 1000;
  return {
    id: row.id,
    name: meta.name,
    scope: meta.scope,
    hint: meta.hint,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    lastUsedAt: used ? row.lastActive.toISOString() : null,
  };
}

async function userTokenRows(userId: string): Promise<Array<{ row: Row; meta: TokenMetadata }>> {
  const rows: Row[] = await prisma.userSession.findMany({
    where: { userId, userAgent: USER_AGENT, isValid: true, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  return rows.flatMap((row) => {
    const meta = readMetadata(row.metadata);
    return meta ? [{ row, meta }] : [];
  });
}

/** The user's live tokens for one workspace, newest first. */
export async function listMcpTokens(userId: string, companyId: string): Promise<McpTokenView[]> {
  const rows = await userTokenRows(userId);
  return rows.filter(({ meta }) => meta.companyId === companyId).map(({ row, meta }) => toView(row, meta));
}

export async function countMcpTokens(userId: string): Promise<number> {
  return (await userTokenRows(userId)).length;
}

/** Creates a token and returns the plain value — the only time it is available. */
export async function createMcpToken(params: {
  userId: string;
  companyId: string;
  name: string;
  scope: McpTokenScope;
  expiresInDays: number;
}): Promise<{ token: string; view: McpTokenView }> {
  const secret = generateMcpSecret();
  const now = new Date();
  const metadata: TokenMetadata = {
    kind: KIND,
    name: params.name,
    companyId: params.companyId,
    scope: params.scope,
    tokenHash: hashMcpSecret(secret),
    hint: mcpTokenHint(secret),
  };
  const row: Row = await prisma.userSession.create({
    data: {
      userId: params.userId,
      userAgent: USER_AGENT,
      expiresAt: new Date(now.getTime() + params.expiresInDays * 86_400_000),
      // Same instant for both: "never used" = lastActive still equals createdAt
      createdAt: now,
      lastActive: now,
      isValid: true,
      metadata,
    },
  });
  return { token: formatMcpToken(row.id, secret), view: toView(row, metadata) };
}

/** Deletes one of the user's tokens. Returns false when it isn't theirs / doesn't exist. */
export async function revokeMcpToken(userId: string, tokenId: string): Promise<boolean> {
  const result = await prisma.userSession.deleteMany({
    where: { id: tokenId, userId, userAgent: USER_AGENT },
  });
  return result.count > 0;
}

/**
 * Verifies a raw bearer token. Returns null for anything malformed, unknown, revoked,
 * expired or with a wrong secret — callers answer all of those with the same 401.
 */
export async function resolveMcpToken(
  raw: string | null,
  ipAddress?: string | null
): Promise<ResolvedMcpToken | null> {
  const parsed = parseMcpToken(raw);
  if (!parsed) return null;

  const row: Row | null = await prisma.userSession.findUnique({ where: { id: parsed.recordId } });
  if (!row || !row.isValid || row.expiresAt.getTime() <= Date.now()) return null;
  const meta = readMetadata(row.metadata);
  if (!meta || !verifyMcpSecret(parsed.secret, meta.tokenHash)) return null;

  if (Date.now() - row.lastActive.getTime() > TOUCH_INTERVAL_MS) {
    void prisma.userSession
      .update({
        where: { id: row.id },
        data: { lastActive: new Date(), ipAddress: ipAddress?.slice(0, 64) || undefined },
      })
      .catch(() => undefined);
  }

  return { tokenId: row.id, userId: row.userId, companyId: meta.companyId, scope: meta.scope };
}
