import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hasLegacyRole } from '@/lib/auth/permissions';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';

export const GET = withTenantRoute(async (_request, { companyId }) => {
  const expenses = await prisma.expense.findMany({
    where: { companyId },
    orderBy: { date: 'desc' },
  });
  return jsonOk(expenses);
});

export const POST = withTenantRoute(async (request, { session, companyId }) => {
  if (!hasLegacyRole(session, 'SUPER_ADMIN', 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const amount = Number(body.amount);
  const date = body.date ? new Date(body.date) : new Date();

  if (!description || Number.isNaN(amount) || amount < 0) {
    return NextResponse.json(
      { error: 'description and a valid amount are required' },
      { status: 400 }
    );
  }
  if (Number.isNaN(date.getTime())) {
    return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
  }

  const expense = await prisma.expense.create({
    data: { description, amount, date, companyId },
  });

  return jsonOk(expense, { status: 201 });
});
