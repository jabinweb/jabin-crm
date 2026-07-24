import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { resolveCompanyBillingUserId } from '@/lib/plan-modules';
import { activatePaidSubscription } from '@/lib/subscription/activate-paid';
import { pruneNonBillingFreeTrials } from '@/lib/subscription/ensure-free-trial';
import { z } from 'zod';

async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user || (session.user as { role?: string }).role !== UserRole.SUPER_ADMIN) {
    return null;
  }
  return session;
}

/** Billing accounts only — one row per company (or solo user). */
export async function GET() {
  const session = await requireSuperAdmin();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const pruned = await pruneNonBillingFreeTrials();

  const subscriptions = await prisma.subscription.findMany({
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          companyId: true,
          primaryCompanyId: true,
          company: { select: { id: true, name: true, slug: true } },
          primaryCompany: { select: { id: true, name: true, slug: true } },
        },
      },
      plan: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  const billingRows: Array<
    (typeof subscriptions)[number] & {
      workspace: { id: string; name: string; slug: string } | null;
      isBillingAccount: true;
    }
  > = [];
  const seenCompanies = new Set<string>();

  for (const sub of subscriptions) {
    const companyId = sub.user.companyId ?? sub.user.primaryCompanyId;
    if (!companyId) {
      billingRows.push({ ...sub, workspace: null, isBillingAccount: true });
      continue;
    }

    const billingId = await resolveCompanyBillingUserId(companyId);
    if (billingId !== sub.userId) continue;
    if (seenCompanies.has(companyId)) continue;
    seenCompanies.add(companyId);

    billingRows.push({
      ...sub,
      workspace: sub.user.company || sub.user.primaryCompany || null,
      isBillingAccount: true,
    });
  }

  const [plans, stats] = await Promise.all([
    prisma.plan.findMany({ where: { isActive: true }, orderBy: { price: 'asc' } }),
    prisma.subscription.groupBy({ by: ['status'], _count: true }),
  ]);

  return NextResponse.json({
    subscriptions: billingRows,
    plans,
    stats,
    prunedOrphanTrials: pruned.deleted,
  });
}

const grantSchema = z.object({
  planId: z.string().min(1),
  userId: z.string().optional(),
  companyId: z.string().optional(),
  periodDays: z.number().int().min(1).max(3650).optional().default(365),
  status: z.enum(['ACTIVE', 'TRIALING']).optional().default('ACTIVE'),
});

/**
 * Manually grant / upgrade a plan for a billing user or company.
 * Body: { planId, userId? | companyId?, periodDays?, status? }
 */
export async function POST(req: NextRequest) {
  const session = await requireSuperAdmin();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const parsed = grantSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { planId, periodDays, status } = parsed.data;
  let userId = parsed.data.userId;

  if (parsed.data.companyId) {
    const company = await prisma.company.findUnique({
      where: { id: parsed.data.companyId },
      select: { id: true },
    });
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }
    userId =
      (await resolveCompanyBillingUserId(company.id)) ||
      (
        await prisma.user.findFirst({
          where: {
            OR: [{ companyId: company.id }, { primaryCompanyId: company.id }],
            role: { in: ['ADMIN', 'SUPER_ADMIN'] },
          },
          orderBy: { createdAt: 'asc' },
          select: { id: true },
        })
      )?.id;
  }

  if (!userId) {
    return NextResponse.json(
      { error: 'Provide userId or companyId with at least one company admin' },
      { status: 400 }
    );
  }

  const result = await activatePaidSubscription({
    userId,
    planId,
    periodDays,
    status,
  });

  // Drop leftover free trials on other company members after a grant
  await pruneNonBillingFreeTrials();

  return NextResponse.json({
    ok: true,
    ...result,
    periodDays,
    status,
  });
}
