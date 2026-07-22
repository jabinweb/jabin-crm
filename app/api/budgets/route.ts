import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hasLegacyRole } from '@/lib/auth/permissions';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';

export const GET = withTenantRoute(async (_request, { companyId }) => {
  const budgets = await prisma.budget.findMany({
    where: { companyId },
    orderBy: { year: 'desc' },
  });
  return jsonOk(budgets);
});

export const POST = withTenantRoute(async (request, { session, companyId }) => {
  if (!hasLegacyRole(session, 'SUPER_ADMIN', 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const year = Number(body.year);
  const amount = Number(body.amount);

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: 'A valid year is required' }, { status: 400 });
  }
  if (Number.isNaN(amount) || amount < 0) {
    return NextResponse.json({ error: 'A valid amount is required' }, { status: 400 });
  }

  const budget = await prisma.budget.create({
    data: { year, amount, companyId },
  });

  return jsonOk(budget, { status: 201 });
});
