import 'dotenv/config';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { prisma } from '../lib/prisma';
import { decrypt } from '../lib/encryption';

const SUMMORA = 'https://summora.jabin.org';
const CRM = 'https://jabin-crm.vercel.app';
const USER_ID = 'cmrwd7r540001aolaegrxhiw6';

async function main() {
  const config = await prisma.whatsAppProviderConfig.findUnique({
    where: { userId: USER_ID },
  });
  if (!config?.summoraBaseUrl || !config.summoraApiKey) {
    throw new Error('CRM WhatsApp SUMMORA config missing');
  }

  const apiKey = decrypt(config.summoraApiKey);
  if (!apiKey) throw new Error('Failed to decrypt Summora API key');

  const base = config.summoraBaseUrl.replace(/\/$/, '');
  const results: Record<string, unknown> = {
    crmDb: {
      provider: config.provider,
      isActive: config.isActive,
      summoraBaseUrl: config.summoraBaseUrl,
      expectedLive: SUMMORA,
      baseMatchesLive: base === SUMMORA,
    },
  };

  // Live Summora bridge connection
  try {
    const res = await fetch(`${base}/api/v1/bridge/connection`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(15000),
    });
    const body = await res.json().catch(() => ({}));
    results.bridgeConnection = { status: res.status, body };
  } catch (e: any) {
    results.bridgeConnection = { error: e.message };
  }

  try {
    const res = await fetch(`${base}/api/v1/bridge/messages?limit=1`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(15000),
    });
    const body = await res.json().catch(() => ({}));
    results.bridgeMessages = {
      status: res.status,
      count: Array.isArray(body.messages) ? body.messages.length : null,
      error: body.error || null,
    };
  } catch (e: any) {
    results.bridgeMessages = { error: e.message };
  }

  // CRM webhook endpoint reachable (GET verify not applicable; OPTIONS/POST empty)
  try {
    const res = await fetch(
      `${CRM}/api/whatsapp/webhook?userId=${USER_ID}&provider=SUMMORA`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'connection.updated',
          data: { status: 'TEST_PING', slug: 'opslane-bridge' },
        }),
        signal: AbortSignal.timeout(15000),
      }
    );
    const text = await res.text();
    results.crmWebhook = {
      status: res.status,
      body: text.slice(0, 200),
    };
  } catch (e: any) {
    results.crmWebhook = { error: e.message };
  }

  // Probe whether bridge route exists at all (unauthenticated)
  try {
    const res = await fetch(`${SUMMORA}/api/v1/bridge/connection`, {
      signal: AbortSignal.timeout(10000),
    });
    results.bridgeRouteProbe = {
      status: res.status,
      note: res.status === 401 ? 'route exists (auth required)' : 'check body',
    };
  } catch (e: any) {
    results.bridgeRouteProbe = { error: e.message };
  }

  console.log(JSON.stringify(results, null, 2));
}

main()
  .catch((e) => {
    console.error('FAILED', e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
