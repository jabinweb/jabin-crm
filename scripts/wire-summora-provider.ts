import 'dotenv/config';
import { prisma } from '../lib/prisma';
import { encrypt } from '../lib/encryption';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

function upsertEnv(filePath: string, entries: Record<string, string>) {
  let content = existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
  if (!content.includes('# Summora WhatsApp bridge')) {
    content = content.trimEnd() + '\n\n# Summora WhatsApp bridge (auto-wired)\n';
  }
  for (const [key, value] of Object.entries(entries)) {
    const line = `${key}="${value.replace(/"/g, '\\"')}"`;
    const re = new RegExp(`^${key}=.*$`, 'm');
    if (re.test(content)) content = content.replace(re, line);
    else content = content.trimEnd() + `\n${line}`;
  }
  writeFileSync(filePath, content.endsWith('\n') ? content : content + '\n', 'utf8');
}

function storeSecret(plain: string) {
  return JSON.stringify(encrypt(plain));
}

async function main() {
  const bridgePath = resolve(
    process.cwd(),
    process.env.BRIDGE_JSON_PATH || '../summora/.bridge-wire.json'
  );
  const bridge = JSON.parse(
    process.env.BRIDGE_JSON ||
      (existsSync(bridgePath) ? readFileSync(bridgePath, 'utf8') : '{}')
  );
  if (!bridge.apiKey || !bridge.webhookSecret) {
    throw new Error('BRIDGE_JSON / .bridge-wire.json missing apiKey/webhookSecret');
  }

  const user =
    (await prisma.user.findUnique({
      where: { email: 'harshit@jabin.org' },
      select: { id: true, email: true },
    })) ||
    (await prisma.user.findFirst({
      where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
      select: { id: true, email: true },
    }));

  if (!user) throw new Error('No admin user found in CRM');

  const summoraBaseUrl = String(bridge.summoraBaseUrl || 'http://localhost:3000').replace(
    /\/$/,
    ''
  );
  const crmPublicUrl = String(
    process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'
  ).replace(/\/$/, '');

  const config = await prisma.whatsAppProviderConfig.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      provider: 'SUMMORA',
      isActive: true,
      summoraBaseUrl,
      summoraApiKey: storeSecret(bridge.apiKey),
      webhookVerifyToken: storeSecret(bridge.webhookSecret),
    },
    update: {
      provider: 'SUMMORA',
      isActive: true,
      summoraBaseUrl,
      summoraApiKey: storeSecret(bridge.apiKey),
      webhookVerifyToken: storeSecret(bridge.webhookSecret),
    },
  });

  upsertEnv(resolve(process.cwd(), '.env'), {
    SUMMORA_BASE_URL: summoraBaseUrl,
    SUMMORA_API_KEY: bridge.apiKey,
    SUMMORA_WEBHOOK_SECRET: bridge.webhookSecret,
    SUMMORA_WORKSPACE_SLUG: bridge.workspaceSlug || '',
    SUMMORA_BRIDGE_APP_ID: bridge.bridgeAppId || '',
  });

  upsertEnv(resolve(process.cwd(), '.env.local'), {
    SUMMORA_BASE_URL: summoraBaseUrl,
    SUMMORA_API_KEY: bridge.apiKey,
    SUMMORA_WEBHOOK_SECRET: bridge.webhookSecret,
  });

  console.log(
    JSON.stringify({
      ok: true,
      userId: user.id,
      email: user.email,
      provider: config.provider,
      isActive: config.isActive,
      summoraBaseUrl,
      hasApiKey: !!config.summoraApiKey,
      hasWebhookSecret: !!config.webhookVerifyToken,
      webhookUrl: `${crmPublicUrl}/api/whatsapp/webhook?userId=${user.id}&provider=SUMMORA`,
    })
  );
}

main()
  .catch((e) => {
    console.error('FAILED', e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
