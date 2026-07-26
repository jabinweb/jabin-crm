import 'dotenv/config';
import { prisma } from '../lib/prisma';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const SUMMORA_LIVE = 'https://summora.jabin.org';
const CRM_LIVE = 'https://jabin-crm.vercel.app';
const USER_ID = 'cmrwd7r540001aolaegrxhiw6';

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

async function main() {
  const wirePath = resolve(
    process.env.BRIDGE_JSON_PATH || '../summora/.bridge-wire.json'
  );
  const wire = existsSync(wirePath)
    ? JSON.parse(readFileSync(wirePath, 'utf8'))
    : {};

  const config = await prisma.whatsAppProviderConfig.update({
    where: { userId: USER_ID },
    data: {
      provider: 'SUMMORA',
      isActive: true,
      summoraBaseUrl: SUMMORA_LIVE,
    },
  });

  upsertEnv(resolve(process.cwd(), '.env'), {
    NEXT_PUBLIC_APP_URL: CRM_LIVE,
    NEXTAUTH_URL: CRM_LIVE,
    SUMMORA_BASE_URL: SUMMORA_LIVE,
    SUMMORA_API_KEY: wire.apiKey || process.env.SUMMORA_API_KEY || '',
    SUMMORA_WEBHOOK_SECRET: wire.webhookSecret || process.env.SUMMORA_WEBHOOK_SECRET || '',
    SUMMORA_WORKSPACE_SLUG: wire.workspaceSlug || 'opslane-bridge',
    SUMMORA_BRIDGE_APP_ID: wire.bridgeAppId || '',
  });

  upsertEnv(resolve(process.cwd(), '.env.local'), {
    NEXT_PUBLIC_APP_URL: CRM_LIVE,
    SUMMORA_BASE_URL: SUMMORA_LIVE,
    SUMMORA_API_KEY: wire.apiKey || process.env.SUMMORA_API_KEY || '',
    SUMMORA_WEBHOOK_SECRET: wire.webhookSecret || process.env.SUMMORA_WEBHOOK_SECRET || '',
  });

  console.log(
    JSON.stringify({
      ok: true,
      provider: config.provider,
      isActive: config.isActive,
      summoraBaseUrl: config.summoraBaseUrl,
      webhookUrl: `${CRM_LIVE}/api/whatsapp/webhook?userId=${USER_ID}&provider=SUMMORA`,
      hasApiKeyInEnv: !!(wire.apiKey || process.env.SUMMORA_API_KEY),
    })
  );
}

main()
  .catch((e) => {
    console.error('FAILED', e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
