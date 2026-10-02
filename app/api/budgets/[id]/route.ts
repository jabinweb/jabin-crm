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
  if (body.year !== undefined) {
    const year = Number(body.year);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return NextResponse.json({ error: 'A valid year is required' }, { status: 400 });
    }
    data.year = year;
  }
  if (body.amount !== undefined) {
    const amount = Number(body.amount);
    if (body.amount === null || body.amount === '' || Number.isNaN(amount) || amount < 0) {
      return NextResponse.json({ error: 'A valid amount is required' }, { status: 400 });
    }
    data.amount = amount;
  }
  if (body.projectId !== undefined) {
    data.projectId =
      typeof body.projectId === 'string' && body.projectId.trim()
        ? body.projectId.trim()
        : null;
  }
  if (data.projectId) {
    const project = await prisma.project.findFirst({
      where: { id: data.projectId as string, companyId },
      select: { id: true },
    });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
  }

  const updated = await prisma.budget.updateMany({
    where: { id, companyId },
    data,
  });
  if (updated.count === 0) {
    return NextResponse.json({ error: 'Budget not found' }, { status: 404 });
  }
  const budget = await prisma.budget.findFirst({
    where: { id, companyId },
    include: { project: { select: { id: true, name: true } } },
  });
  return jsonOk(budget);
});

export const DELETE = withTenantRoute(async (_request, { session, companyId }, routeContext) => {
  if (!hasLegacyRole(session, 'SUPER_ADMIN', 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const id = (await routeContext!.params).id as string;
  const deleted = await prisma.budget.deleteMany({ where: { id, companyId } });
  if (deleted.count === 0) {
    return NextResponse.json({ error: 'Budget not found' }, { status: 404 });
  }
  return jsonOk({ success: true });
});
