import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hasLegacyRole } from '@/lib/auth/permissions';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';
import { nextBillDate } from '@/lib/projects/agency-delivery';

export const PATCH = withTenantRoute(async (request, { session, companyId }, routeContext) => {
  if (!hasLegacyRole(session, 'SUPER_ADMIN', 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const id = (await routeContext!.params).id;
  const existing = await prisma.clientRetainer.findFirst({
    where: { id, companyId },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await request.json();
  const data: Record<string, unknown> = {};

  if (typeof body.name === 'string') data.name = body.name.trim();
  if (typeof body.description === 'string') data.description = body.description;
  if (typeof body.amount === 'number') data.amount = body.amount;
  if (typeof body.currency === 'string') data.currency = body.currency;
  if (typeof body.billingCycle === 'string') data.billingCycle = body.billingCycle;
  if (typeof body.status === 'string') data.status = body.status;
  if (body.nextBillAt !== undefined) {
    data.nextBillAt = body.nextBillAt ? new Date(body.nextBillAt) : null;
  }
  if (body.projectId !== undefined) {
    data.projectId =
      typeof body.projectId === 'string' && body.projectId.trim()
        ? body.projectId.trim()
        : null;
  }
  if (body.endDate !== undefined) {
    data.endDate = body.endDate ? new Date(body.endDate) : null;
  }

  /** Generate a draft invoice for this retainer period */
  if (body.action === 'bill_now') {
    const invoiceNumber = `RET-${Date.now().toString(36).toUpperCase()}`;
    const due = new Date();
    due.setDate(due.getDate() + 14);

    const customer = await prisma.customer.findUnique({
      where: { id: existing.customerId },
      select: {
        organizationName: true,
        email: true,
        phone: true,
        address: true,
      },
    });

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        userId: session.user!.id,
        customerId: existing.customerId,
        title: existing.name,
        description: existing.description || `Retainer: ${existing.name}`,
        dueDate: due,
        currency: existing.currency,
        subtotal: existing.amount,
        total: existing.amount,
        amountDue: existing.amount,
        status: 'DRAFT',
        customerName: customer?.organizationName || 'Client',
        customerEmail: customer?.email || '',
        customerPhone: customer?.phone,
        customerAddress: customer?.address,
        items: {
          create: [
            {
              name: existing.name,
              description: `${existing.billingCycle} retainer`,
              quantity: 1,
              unitPrice: existing.amount,
              amount: existing.amount,
            },
          ],
        },
      },
    });

    const billedAt = new Date();
    const updated = await prisma.clientRetainer.update({
      where: { id },
      data: {
        lastBilledAt: billedAt,
        nextBillAt: nextBillDate(billedAt, existing.billingCycle),
      },
      include: {
        customer: { select: { id: true, organizationName: true } },
        project: { select: { id: true, name: true } },
      },
    });

    return jsonOk({ retainer: updated, invoice });
  }

  const updated = await prisma.clientRetainer.update({
    where: { id },
    data,
    include: {
      customer: { select: { id: true, organizationName: true } },
      project: { select: { id: true, name: true } },
    },
  });
  return jsonOk(updated);
});

export const DELETE = withTenantRoute(async (_request, { session, companyId }, routeContext) => {
  if (!hasLegacyRole(session, 'SUPER_ADMIN', 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const id = (await routeContext!.params).id;
  const deleted = await prisma.clientRetainer.deleteMany({
    where: { id, companyId },
  });
  if (!deleted.count) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return new Response(null, { status: 204 });
});
