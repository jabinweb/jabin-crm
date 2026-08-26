import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hasLegacyRole } from '@/lib/auth/permissions';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';
import { nextBillDate } from '@/lib/projects/agency-delivery';

export const GET = withTenantRoute(async (request, { companyId }) => {
  const url = new URL(request.url);
  const customerId = url.searchParams.get('customerId');
  const status = url.searchParams.get('status');

  const retainers = await prisma.clientRetainer.findMany({
    where: {
      companyId,
      ...(customerId ? { customerId } : {}),
      ...(status ? { status } : {}),
    },
    include: {
      customer: { select: { id: true, organizationName: true } },
      project: { select: { id: true, name: true } },
    },
    orderBy: [{ status: 'asc' }, { nextBillAt: 'asc' }],
  });
  return jsonOk(retainers);
});

export const POST = withTenantRoute(async (request, { session, companyId }) => {
  if (!hasLegacyRole(session, 'SUPER_ADMIN', 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const customerId =
    typeof body.customerId === 'string' ? body.customerId.trim() : '';
  const amount = Number(body.amount);
  if (!name || !customerId || !Number.isFinite(amount) || amount < 0) {
    return NextResponse.json(
      { error: 'name, customerId, and amount are required' },
      { status: 400 }
    );
  }

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, companyId },
  });
  if (!customer) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }

  const billingCycle =
    typeof body.billingCycle === 'string' ? body.billingCycle : 'MONTHLY';
  const startDate = body.startDate ? new Date(body.startDate) : new Date();
  const projectId =
    typeof body.projectId === 'string' && body.projectId.trim()
      ? body.projectId.trim()
      : null;

  let includedHours: number | null = null;
  if (body.includedHours !== undefined && body.includedHours !== null && body.includedHours !== '') {
    const n = Number(body.includedHours);
    if (Number.isFinite(n) && n >= 0) includedHours = n;
  }

  const retainer = await prisma.clientRetainer.create({
    data: {
      companyId,
      customerId,
      projectId,
      name,
      description: typeof body.description === 'string' ? body.description : null,
      amount,
      currency:
        typeof body.currency === 'string'
          ? body.currency
          : customer.billingCurrency || 'USD',
      billingCycle,
      includedHours,
      status: 'ACTIVE',
      startDate,
      nextBillAt: nextBillDate(startDate, billingCycle),
    },
    include: {
      customer: { select: { id: true, organizationName: true } },
      project: { select: { id: true, name: true } },
    },
  });

  return jsonOk(retainer, { status: 201 });
});
