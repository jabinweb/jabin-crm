import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hasLegacyRole } from '@/lib/auth/permissions';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';

export const PATCH = withTenantRoute(async (request, { session, companyId }, routeContext) => {
  if (!hasLegacyRole(session, 'SUPER_ADMIN', 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const id = (await routeContext!.params).id as string;
  const body = await request.json();
  const data: Record<string, unknown> = {};
  if (typeof body.description === 'string') {
    if (!body.description.trim()) {
      return NextResponse.json({ error: 'description cannot be empty' }, { status: 400 });
    }
    data.description = body.description.trim();
  }
  if (body.amount !== undefined) {
    const amount = Number(body.amount);
    if (body.amount === null || body.amount === '' || Number.isNaN(amount) || amount < 0) {
      return NextResponse.json({ error: 'amount must be a non-negative number' }, { status: 400 });
    }
    data.amount = amount;
  }
  if (body.date) {
    const date = new Date(body.date);
    if (Number.isNaN(date.getTime())) {
      return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
    }
    data.date = date;
  }

  const updated = await prisma.expense.updateMany({
    where: { id, companyId },
    data,
  });
  if (updated.count === 0) {
    return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
  }
  const expense = await prisma.expense.findFirst({ where: { id, companyId } });
  return jsonOk(expense);
});

export const DELETE = withTenantRoute(async (_request, { session, companyId }, routeContext) => {
  if (!hasLegacyRole(session, 'SUPER_ADMIN', 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const id = (await routeContext!.params).id as string;
  const deleted = await prisma.expense.deleteMany({ where: { id, companyId } });
  if (deleted.count === 0) {
    return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
  }
  return jsonOk({ success: true });
});
