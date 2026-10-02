import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Opslane MCP personal access tokens.
 *
 * Format: `opl_<recordId>_<secret>`
 * - `recordId` is the storage row id (a cuid: lowercase letters and digits, no `_`), so a
 *   token is looked up by primary key instead of scanning hashes.
 * - `secret` is 32 random bytes, base64url. Only its SHA-256 is stored; the full token is
 *   shown to the user once and can't be recovered afterwards.
 *
 * Pure module (no Prisma) so it can be unit-tested.
 */
export const MCP_TOKEN_PREFIX = 'opl_';

export type McpTokenScope = 'read' | 'read_write';

export const MCP_TOKEN_SCOPES: readonly McpTokenScope[] = ['read', 'read_write'];

/** Allowed lifetimes offered in the UI, in days. */
export const MCP_TOKEN_EXPIRY_DAYS = [30, 90, 365] as const;
export const DEFAULT_MCP_TOKEN_EXPIRY_DAYS = 90;

const RECORD_ID_RE = /^[a-z0-9]{8,40}$/;
const SECRET_RE = /^[A-Za-z0-9_-]{32,128}$/;

export function parseMcpTokenScope(value: unknown): McpTokenScope {
  return value === 'read_write' ? 'read_write' : 'read';
}

export function parseMcpTokenExpiryDays(value: unknown): number {
  const n = typeof value === 'string' ? Number(value) : value;
  return (MCP_TOKEN_EXPIRY_DAYS as readonly number[]).includes(n as number)
    ? (n as number)
    : DEFAULT_MCP_TOKEN_EXPIRY_DAYS;
}

export function generateMcpSecret(): string {
  return randomBytes(32).toString('base64url');
}

export function hashMcpSecret(secret: string): string {
  return createHash('sha256').update(secret, 'utf8').digest('hex');
}

export function formatMcpToken(recordId: string, secret: string): string {
  return `${MCP_TOKEN_PREFIX}${recordId}_${secret}`;
}

/** Splits a raw token into its record id and secret, or null when it isn't one of ours. */
export function parseMcpToken(raw: string | null | undefined): { recordId: string; secret: string } | null {
  if (typeof raw !== 'string') return null;
  const token = raw.trim();
  if (!token.startsWith(MCP_TOKEN_PREFIX) || token.length > 256) return null;
  const rest = token.slice(MCP_TOKEN_PREFIX.length);
  const sep = rest.indexOf('_');
  if (sep <= 0) return null;
  const recordId = rest.slice(0, sep);
  const secret = rest.slice(sep + 1);
  if (!RECORD_ID_RE.test(recordId) || !SECRET_RE.test(secret)) return null;
  return { recordId, secret };
}

/** Constant-time comparison of a presented secret against the stored hash. */
export function verifyMcpSecret(secret: string, storedHash: string | null | undefined): boolean {
  if (!storedHash || !/^[a-f0-9]{64}$/.test(storedHash)) return false;
  const a = Buffer.from(hashMcpSecret(secret), 'hex');
  const b = Buffer.from(storedHash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Reads `Authorization: Bearer <token>`. */
export function bearerTokenFromHeader(header: string | null | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header.trim());
  return match ? match[1] : null;
}

/** Last characters of the secret, shown in the token list so users can tell tokens apart. */
export function mcpTokenHint(secret: string): string {
  return `opl_…${secret.slice(-4)}`;
}
