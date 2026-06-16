import { prisma } from '@/lib/prisma';
import { ApiErrors } from '@/lib/api-error-handler';
import {
  getPlanModuleMapForCompany,
  getPlanModuleMapForUser,
} from '@/lib/plan-modules';
import {
  ALL_FEATURE_MODULES,
  FEATURE_MODULE_LABELS,
  type FeatureModuleKey,
  type PlanModuleMap,
} from '@/lib/feature-module-keys';

export {
  ALL_FEATURE_MODULES,
  FEATURE_MODULE_LABELS,
  type FeatureModuleKey,
  type PlanModuleMap,
} from '@/lib/feature-module-keys';

async function isSuperAdmin(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  return user?.role === 'SUPER_ADMIN';
}

function mergeModuleMaps(
  planModules: PlanModuleMap,
  userOverrides: Partial<Record<FeatureModuleKey, boolean>>
): Record<FeatureModuleKey, boolean> {
  const map = {} as Record<FeatureModuleKey, boolean>;
  for (const module of ALL_FEATURE_MODULES) {
    const planAllowed = planModules[module] === true;
    const override = userOverrides[module];
    map[module] = planAllowed && (override !== false);
  }
  return map;
}

export async function getPlanModulesForUser(userId: string): Promise<PlanModuleMap> {
  if (await isSuperAdmin(userId)) {
    return Object.fromEntries(ALL_FEATURE_MODULES.map((m) => [m, true])) as PlanModuleMap;
  }
  return getPlanModuleMapForUser(userId);
}

export async function getFeatureModuleMap(
  userId: string
): Promise<Record<FeatureModuleKey, boolean>> {
  if (await isSuperAdmin(userId)) {
    return Object.fromEntries(ALL_FEATURE_MODULES.map((m) => [m, true])) as Record<
      FeatureModuleKey,
      boolean
    >;
  }

  const [planModules, rows] = await Promise.all([
    getPlanModuleMapForUser(userId),
    prisma.featureModuleSetting.findMany({
      where: { userId },
      select: { module: true, enabled: true },
    }),
  ]);

  const overrides: Partial<Record<FeatureModuleKey, boolean>> = {};
  for (const row of rows) {
    overrides[row.module as FeatureModuleKey] = row.enabled;
  }

  return mergeModuleMaps(planModules, overrides);
}

export async function isFeatureEnabled(
  userId: string,
  module: FeatureModuleKey
): Promise<boolean> {
  const map = await getFeatureModuleMap(userId);
  return map[module] === true;
}

export async function isFeatureEnabledForCompany(
  companyId: string,
  module: FeatureModuleKey
): Promise<boolean> {
  const planModules = await getPlanModuleMapForCompany(companyId);
  return planModules[module] === true;
}

export async function ensureFeatureEnabled(userId: string, module: FeatureModuleKey) {
  const enabled = await isFeatureEnabled(userId, module);
  if (!enabled) {
    throw ApiErrors.forbidden(`Feature "${FEATURE_MODULE_LABELS[module]}" is not included in your subscription plan.`);
  }
}

export async function ensureFeatureEnabledForCompany(
  companyId: string,
  module: FeatureModuleKey
) {
  const enabled = await isFeatureEnabledForCompany(companyId, module);
  if (!enabled) {
    throw ApiErrors.forbidden(`Feature "${FEATURE_MODULE_LABELS[module]}" is not included in your subscription plan.`);
  }
}

export async function setFeatureModules(
  userId: string,
  modules: Array<{ module: FeatureModuleKey; enabled: boolean }>
) {
  const planModules = await getPlanModuleMapForUser(userId);

  await prisma.$transaction(
    modules.map((item) => {
      const planAllowed = planModules[item.module] === true;
      const enabled = planAllowed ? item.enabled : false;

      return prisma.featureModuleSetting.upsert({
        where: { userId_module: { userId, module: item.module } },
        update: { enabled },
        create: { userId, module: item.module, enabled },
      });
    })
  );
}
