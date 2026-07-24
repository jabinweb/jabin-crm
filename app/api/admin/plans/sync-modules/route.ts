import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { UserRole } from '@prisma/client';
import { DEFAULT_PLAN_MODULES } from '@/lib/plan-modules';
import { PLAN_CATALOG, PLAN_LIST_PRICES_PAISE } from '@/lib/pricing/catalog';

async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user || (session.user as { role?: string }).role !== UserRole.SUPER_ADMIN) {
    return null;
  }
  return session;
}

/**
 * Sync plan modules (and optionally catalog limits/features) from code defaults.
 * POST ?force=1 — overwrite modules even when already set
 * POST ?catalog=1 — also refresh price, limits, features, isActive from PLAN_CATALOG
 */
export async function POST(req: NextRequest) {
  const session = await requireSuperAdmin();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const force = req.nextUrl.searchParams.get('force') === '1';
  const catalog = req.nextUrl.searchParams.get('catalog') === '1';

  try {
    const plans = await prisma.plan.findMany();
    let updated = 0;

    for (const plan of plans) {
      const hasModules =
        plan.modules &&
        typeof plan.modules === 'object' &&
        !Array.isArray(plan.modules) &&
        Object.keys(plan.modules as object).length > 0;

      if (hasModules && !force && !catalog) continue;

      const defaults = DEFAULT_PLAN_MODULES[plan.name] ?? DEFAULT_PLAN_MODULES.free;
      const catalogEntry = PLAN_CATALOG[plan.name as keyof typeof PLAN_CATALOG];
      const data: Record<string, unknown> = {
        modules: defaults,
      };

      if (catalog && catalogEntry) {
        data.displayName = catalogEntry.displayName;
        data.description = catalogEntry.description;
        data.price = PLAN_LIST_PRICES_PAISE[plan.name] ?? catalogEntry.pricePaise;
        data.maxLeads = catalogEntry.maxLeads;
        data.maxEmails = catalogEntry.maxEmails;
        data.maxCampaigns = catalogEntry.maxCampaigns;
        data.features = [...catalogEntry.features];
        data.isActive = true;
      }

      await prisma.plan.update({
        where: { id: plan.id },
        data,
      });
      updated++;
    }

    // Ensure every catalog plan exists and is active
    if (catalog) {
      for (const key of Object.keys(PLAN_CATALOG) as Array<keyof typeof PLAN_CATALOG>) {
        const entry = PLAN_CATALOG[key];
        const price = PLAN_LIST_PRICES_PAISE[key] ?? entry.pricePaise;
        const modules = DEFAULT_PLAN_MODULES[key] ?? {};
        await prisma.plan.upsert({
          where: { name: entry.name },
          create: {
            name: entry.name,
            displayName: entry.displayName,
            description: entry.description,
            price,
            currency: 'INR',
            interval: entry.interval,
            maxLeads: entry.maxLeads,
            maxEmails: entry.maxEmails,
            maxCampaigns: entry.maxCampaigns,
            features: [...entry.features],
            modules,
            isActive: true,
          },
          update: {
            displayName: entry.displayName,
            description: entry.description,
            price,
            maxLeads: entry.maxLeads,
            maxEmails: entry.maxEmails,
            maxCampaigns: entry.maxCampaigns,
            features: [...entry.features],
            modules,
            isActive: true,
          },
        });
      }
    }

    return NextResponse.json({ success: true, updated, force, catalog });
  } catch (e) {
    console.error('[admin/plans/sync-modules]', e);
    return NextResponse.json({ error: 'Failed to sync plan modules' }, { status: 500 });
  }
}
