import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';

export type SummoraCreds =
  | { baseUrl: string; apiKey: string; userId: string }
  | { error: string; status: 400 };

/** Resolve active Summora bridge credentials for a user. */
export async function getSummoraCreds(userId: string): Promise<SummoraCreds> {
  const config = await prisma.whatsAppProviderConfig.findUnique({
    where: { userId },
  });
  if (!config || config.provider !== 'SUMMORA' || !config.isActive) {
    return { error: 'Summora WhatsApp provider is not active', status: 400 };
  }
  const baseUrl = String(config.summoraBaseUrl || '').replace(/\/$/, '');
  const apiKey = config.summoraApiKey ? decrypt(config.summoraApiKey) : '';
  if (!baseUrl || !apiKey) {
    return { error: 'Summora base URL or API key missing', status: 400 };
  }
  return { baseUrl, apiKey, userId };
}

export async function fetchSummoraBridge(
  creds: { baseUrl: string; apiKey: string },
  path: string,
  init?: RequestInit & { timeoutMs?: number }
): Promise<{ ok: true; status: number; body: Record<string, unknown> } | { ok: false; status: number; error: string; body?: Record<string, unknown> }> {
  const timeoutMs = init?.timeoutMs ?? 20_000;
  const { timeoutMs: _t, ...rest } = init ?? {};
  try {
    const res = await fetch(`${creds.baseUrl}${path}`, {
      ...rest,
      headers: {
        Authorization: `Bearer ${creds.apiKey}`,
        ...(rest.body ? { 'Content-Type': 'application/json' } : {}),
        ...(rest.headers || {}),
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    });
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: String(body.error || `Summora request failed (${res.status})`),
        body,
      };
    }
    return { ok: true, status: res.status, body };
  } catch (error) {
    const message =
      error instanceof Error
        ? /aborted|timeout/i.test(error.message) || error.name === 'TimeoutError'
          ? 'Summora bridge timed out — try again in a moment'
          : error.message
        : 'Failed to reach Summora bridge';
    return { ok: false, status: 504, error: message };
  }
}
