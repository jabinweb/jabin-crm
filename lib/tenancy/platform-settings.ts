import { prisma } from '@/lib/prisma';
import {
  getEnvTenancyMode,
  parseTenancyMode,
  type TenancyMode,
} from '@/lib/tenancy/mode';

const PLATFORM_SETTING_ID = 'default';

export type PlatformTenancyConfig = {
  tenancyMode: TenancyMode;
  /** Where the effective value came from */
  source: 'database' | 'env';
  envTenancyMode: TenancyMode;
};

export async function getPlatformTenancyConfig(): Promise<PlatformTenancyConfig> {
  const envTenancyMode = getEnvTenancyMode();

  try {
    const row = await prisma.platformSetting.findUnique({
      where: { id: PLATFORM_SETTING_ID },
    });
    const fromDb = parseTenancyMode(row?.tenancyMode);
    if (fromDb) {
      return { tenancyMode: fromDb, source: 'database', envTenancyMode };
    }
  } catch {
    // Table may not exist yet before migrate/push
  }

  return { tenancyMode: envTenancyMode, source: 'env', envTenancyMode };
}

export async function getEffectiveTenancyMode(): Promise<TenancyMode> {
  const cfg = await getPlatformTenancyConfig();
  return cfg.tenancyMode;
}

export async function setPlatformTenancyMode(
  mode: TenancyMode,
  updatedBy?: string | null
): Promise<PlatformTenancyConfig> {
  await prisma.platformSetting.upsert({
    where: { id: PLATFORM_SETTING_ID },
    create: {
      id: PLATFORM_SETTING_ID,
      tenancyMode: mode,
      updatedBy: updatedBy ?? null,
    },
    update: {
      tenancyMode: mode,
      updatedBy: updatedBy ?? null,
    },
  });

  return getPlatformTenancyConfig();
}
