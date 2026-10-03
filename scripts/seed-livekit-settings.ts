/**
 * Save team-meeting video (LiveKit) credentials to PlatformSetting — secret encrypted
 * with ENCRYPTION_KEY, so run it with the SAME ENCRYPTION_KEY as production.
 * Values come from the environment of this run (nothing is hard-coded):
 *   SEED_LIVEKIT_URL=wss://... SEED_LIVEKIT_API_KEY=... SEED_LIVEKIT_API_SECRET=... \
 *     pnpm exec ts-node -r tsconfig-paths/register -r dotenv/config scripts/seed-livekit-settings.ts
 * (Falls back to LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET.)
 */
import 'dotenv/config';
import { prisma } from '../lib/prisma';
import { getLiveKitConfigSummary, setLiveKitConfig } from '../lib/meetings/livekit-config';

const url = (process.env.SEED_LIVEKIT_URL || process.env.LIVEKIT_URL || '').trim();
const apiKey = (process.env.SEED_LIVEKIT_API_KEY || process.env.LIVEKIT_API_KEY || '').trim();
const apiSecret = (process.env.SEED_LIVEKIT_API_SECRET || process.env.LIVEKIT_API_SECRET || '').trim();

async function main() {
  if (!url || !apiKey || !apiSecret) {
    throw new Error('Set SEED_LIVEKIT_URL, SEED_LIVEKIT_API_KEY and SEED_LIVEKIT_API_SECRET');
  }
  if (!/^wss?:\/\//.test(url)) throw new Error('SEED_LIVEKIT_URL must start with wss://');
  if (!process.env.ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY is not set — the secret would not decrypt in production');
  }

  await setLiveKitConfig({ url, apiKey, apiSecret, updatedBy: 'seed-livekit-settings' });
  // Prints the summary only — never the secret
  console.log(JSON.stringify(await getLiveKitConfigSummary()));
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
