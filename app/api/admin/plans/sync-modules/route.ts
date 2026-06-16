import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { UserRole } from '@prisma/client';
import { DEFAULT_PLAN_MODULES } from '@/lib/plan-modules';

async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user || (session.user as { role?: string }).role !== UserRole.SUPER_ADMIN) {
    return null;
  }
  return session;
}

/** Apply code defaults to all plans missing or empty modules JSON. */
export async function POST() {
  const session = await requireSuperAdmin();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const plans = await prisma.plan.findMany({ select: { id: true, name: true, modules: true } });
    let updated = 0;

    for (const plan of plans) {
      const hasModules =
        plan.modules &&
        typeof plan.modules === 'object' &&
        !Array.isArray(plan.modules) &&
        Object.keys(plan.modules as object).length > 0;

      if (hasModules) continue;

      const defaults = DEFAULT_PLAN_MODULES[plan.name] ?? DEFAULT_PLAN_MODULES.free;
      await prisma.plan.update({
        where: { id: plan.id },
        data: { modules: defaults },
      });
      updated++;
    }

    return NextResponse.json({ success: true, updated });
  } catch (e) {
    console.error('[admin/plans/sync-modules]', e);
    return NextResponse.json({ error: 'Failed to sync plan modules' }, { status: 500 });
  }
}
