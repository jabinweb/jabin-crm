import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-middleware';
import { handleApiError } from '@/lib/api-error-handler';
import {
  getFeatureModuleMap,
  getPlanModulesForUser,
  setFeatureModules,
  ALL_FEATURE_MODULES,
  type FeatureModuleKey,
} from '@/lib/feature-modules';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    await requireAdmin(_req);
    const { userId } = await params;

    const [modules, planModules] = await Promise.all([
      getFeatureModuleMap(userId),
      getPlanModulesForUser(userId),
    ]);

    return NextResponse.json({ modules, planModules });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    await requireAdmin(req);
    const { userId } = await params;
    const body = await req.json();
    const modules = Array.isArray(body.modules) ? body.modules : [];

    const valid = modules.filter(
      (item: { module?: string; enabled?: boolean }) =>
        item.module &&
        ALL_FEATURE_MODULES.includes(item.module as FeatureModuleKey) &&
        typeof item.enabled === 'boolean'
    ) as Array<{ module: FeatureModuleKey; enabled: boolean }>;

    await setFeatureModules(userId, valid);
    const updated = await getFeatureModuleMap(userId);

    return NextResponse.json({ modules: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
