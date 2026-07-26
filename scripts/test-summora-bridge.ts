import 'dotenv/config';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { prisma } from '../lib/prisma';
import { decrypt } from '../lib/encryption';

async function main() {
  const userId = 'cmrwd7r540001aolaegrxhiw6';
  const config = await prisma.whatsAppProviderConfig.findUnique({ where: { userId } });
  if (!config) throw new Error('No WhatsApp config');
  if (config.provider !== 'SUMMORA' || !config.isActive) {
    throw new Error(`Provider not SUMMORA/active: ${config.provider} active=${config.isActive}`);
  }

  const apiKey = config.summoraApiKey ? decrypt(config.summoraApiKey) : '';
  const webhookSecret = config.webhookVerifyToken
    ? decrypt(config.webhookVerifyToken)
    : '';
  if (!apiKey || !config.summoraBaseUrl) {
    throw new Error('Missing decrypted Summora credentials');
  }

  const bridgeFile = resolve('../summora/.bridge-wire.json');
  const fileOk = existsSync(bridgeFile);
  const file = fileOk ? JSON.parse(readFileSync(bridgeFile, 'utf8')) : null;
  const keysMatch = file ? file.apiKey === apiKey : null;

  const base = config.summoraBaseUrl.replace(/\/$/, '');
  let connection: Record<string, unknown> = {};
  let connectionHttp = 0;
  try {
    const res = await fetch(`${base}/api/v1/bridge/connection`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(8000),
    });
    connectionHttp = res.status;
    connection = await res.json().catch(() => ({}));
  } catch (e: any) {
    connection = { error: e.message, note: 'Summora server may be offline' };
  }

  let messagesHttp = 0;
  let messages: Record<string, unknown> = {};
  try {
    const res = await fetch(`${base}/api/v1/bridge/messages?limit=1`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(8000),
    });
    messagesHttp = res.status;
    messages = await res.json().catch(() => ({}));
  } catch (e: any) {
    messages = { error: e.message };
  }

  console.log(
    JSON.stringify(
      {
        crm: {
          provider: config.provider,
          isActive: config.isActive,
          summoraBaseUrl: config.summoraBaseUrl,
          apiKeyDecrypted: !!apiKey,
          webhookSecretDecrypted: !!webhookSecret,
          keysMatchBridgeFile: keysMatch,
        },
        summoraHttp: {
          connectionStatus: connectionHttp,
          connection,
          messagesStatus: messagesHttp,
          messageCount: Array.isArray((messages as any).messages)
            ? (messages as any).messages.length
            : null,
        },
      },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error('FAILED', e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
