import { prisma } from '@/lib/prisma';
import { ApiErrors } from '@/lib/api-error-handler';

export const ALL_FEATURE_MODULES = [
  'LEADS',
  'DEALS',
  'QUOTATIONS',
  'INVOICES',
  'TICKETS',
  'SERVICE_REPORTS',
  'SERVICE_CASH',
  'SERVICE_EXPENSES',
  'SERVICE_GPS',
  'WHATSAPP',
  'EMAIL_OUTREACH',
] as const;

export type FeatureModuleKey = (typeof ALL_FEATURE_MODULES)[number];

export async function getFeatureModuleMap(userId: string): Promise<Record<FeatureModuleKey, boolean>> {
  const rows = await prisma.featureModuleSetting.findMany({
    where: { userId },
    select: { module: true, enabled: true },
  });

  const map = Object.fromEntries(ALL_FEATURE_MODULES.map((m) => [m, true])) as Record<FeatureModuleKey, boolean>;
  for (const row of rows) {
    map[row.module] = row.enabled;
  }
  return map;
}

export async function isFeatureEnabled(userId: string, module: FeatureModuleKey): Promise<boolean> {
  const row = await prisma.featureModuleSetting.findUnique({
    where: { userId_module: { userId, module } },
    select: { enabled: true },
  });
  return row ? row.enabled : true;
}

export async function ensureFeatureEnabled(userId: string, module: FeatureModuleKey) {
  const enabled = await isFeatureEnabled(userId, module);
  if (!enabled) {
    throw ApiErrors.forbidden();
  }
}

export async function setFeatureModules(
  userId: string,
  modules: Array<{ module: FeatureModuleKey; enabled: boolean }>
) {
  await prisma.$transaction(
    modules.map((item) =>
      prisma.featureModuleSetting.upsert({
        where: { userId_module: { userId, module: item.module } },
        update: { enabled: item.enabled },
        create: { userId, module: item.module, enabled: item.enabled },
      })
    )
  );
}
