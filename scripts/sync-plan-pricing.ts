/**
 * Sync Plan rows to canonical India list prices (+ features).
 * Usage: npx tsx scripts/sync-plan-pricing.ts
 */
import 'dotenv/config';
import { prisma } from '../lib/prisma';
import { PLAN_CATALOG, PLAN_LIST_PRICES_PAISE } from '../lib/pricing/catalog';
import { DEFAULT_PLAN_MODULES } from '../lib/plan-modules';

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }

  for (const key of Object.keys(PLAN_CATALOG) as Array<keyof typeof PLAN_CATALOG>) {
    const catalog = PLAN_CATALOG[key];
    const price = PLAN_LIST_PRICES_PAISE[key] ?? catalog.pricePaise;
    const modules = DEFAULT_PLAN_MODULES[key] ?? {};

    const existing = await prisma.plan.findUnique({ where: { name: catalog.name } });

    if (existing) {
      await prisma.plan.update({
        where: { id: existing.id },
        data: {
          displayName: catalog.displayName,
          description: catalog.description,
          price,
          currency: 'INR',
          interval: catalog.interval,
          maxLeads: catalog.maxLeads,
          maxEmails: catalog.maxEmails,
          maxCampaigns: catalog.maxCampaigns,
          features: [...catalog.features],
          modules,
          isActive: true,
        },
      });
      console.log(`Updated ${catalog.name}: ₹${price / 100}/mo`);
    } else {
      await prisma.plan.create({
        data: {
          name: catalog.name,
          displayName: catalog.displayName,
          description: catalog.description,
          price,
          currency: 'INR',
          interval: catalog.interval,
          maxLeads: catalog.maxLeads,
          maxEmails: catalog.maxEmails,
          maxCampaigns: catalog.maxCampaigns,
          features: [...catalog.features],
          modules,
          isActive: true,
        },
      });
      console.log(`Created ${catalog.name}: ₹${price / 100}/mo`);
    }
  }

  const plans = await prisma.plan.findMany({ orderBy: { price: 'asc' } });
  console.log('\nActive plans:');
  for (const p of plans) {
    console.log(`  ${p.name.padEnd(14)} ₹${(p.price / 100).toLocaleString('en-IN')}/${p.interval}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect?.();
  });
