/**
 * Where team-meeting video (LiveKit) credentials come from — server only.
 * Super admins save them in PlatformSetting (secret encrypted with lib/encryption);
 * LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET env vars are the fallback.
 * Fields resolve together: a complete DB set wins, otherwise the env set is used.
 */
import { prisma } from '@/lib/prisma';
import { decrypt, encrypt } from '@/lib/encryption';

const PLATFORM_SETTING_ID = 'default';
// Short cache: tokens are minted per join, no need to hit the DB every time
const CACHE_MS = 30_000;

export type LiveKitConfig = {
  url: string | null;
  apiKey: string | null;
  apiSecret: string | null;
  source: 'database' | 'env' | 'none';
};

let cached: { at: number; value: LiveKitConfig } | null = null;

function fromEnv(): LiveKitConfig {
  const url = process.env.LIVEKIT_URL?.trim() || process.env.NEXT_PUBLIC_LIVEKIT_URL?.trim() || null;
  const apiKey = process.env.LIVEKIT_API_KEY?.trim() || null;
  const apiSecret = process.env.LIVEKIT_API_SECRET?.trim() || null;
  return { url, apiKey, apiSecret, source: url || apiKey || apiSecret ? 'env' : 'none' };
}

export function clearLiveKitConfigCache() {
  cached = null;
}

export async function getLiveKitConfig(): Promise<LiveKitConfig> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value;

  let value = fromEnv();
  try {
    const row = await prisma.platformSetting.findUnique({
      where: { id: PLATFORM_SETTING_ID },
      select: { livekitUrl: true, livekitApiKey: true, livekitApiSecret: true },
    });
    const url = row?.livekitUrl?.trim();
    const apiKey = row?.livekitApiKey?.trim();
    const apiSecret = row?.livekitApiSecret ? decrypt(row.livekitApiSecret) : '';
    if (url && apiKey && apiSecret) {
      value = { url, apiKey, apiSecret, source: 'database' };
    }
  } catch {
    // Column / table not migrated yet — env only
  }

  cached = { at: Date.now(), value };
  return value;
}

/** Super-admin view: never returns the secret. */
export async function getLiveKitConfigSummary() {
  const cfg = await getLiveKitConfig();
  return {
    livekitUrl: cfg.url,
    livekitApiKey: cfg.apiKey,
    livekitSecretSet: !!cfg.apiSecret,
    livekitSource: cfg.source,
    livekitConfigured: !!(cfg.url && cfg.apiKey && cfg.apiSecret),
  };
}

export async function setLiveKitConfig(params: {
  url?: string | null;
  apiKey?: string | null;
  /** New secret; omit or empty string keeps the stored one */
  apiSecret?: string | null;
  /** Remove all three (fall back to env) */
  clear?: boolean;
  updatedBy?: string | null;
}) {
  const data: Record<string, string | null> = {};
  if (params.clear) {
    data.livekitUrl = null;
    data.livekitApiKey = null;
    data.livekitApiSecret = null;
  } else {
    if (params.url !== undefined) data.livekitUrl = params.url?.trim() || null;
    if (params.apiKey !== undefined) data.livekitApiKey = params.apiKey?.trim() || null;
    const secret = params.apiSecret?.trim();
    if (secret) data.livekitApiSecret = JSON.stringify(encrypt(secret));
  }

  await prisma.platformSetting.upsert({
    where: { id: PLATFORM_SETTING_ID },
    create: { id: PLATFORM_SETTING_ID, ...data, updatedBy: params.updatedBy ?? null },
    update: { ...data, updatedBy: params.updatedBy ?? null },
  });
  clearLiveKitConfigCache();
  return getLiveKitConfigSummary();
}
