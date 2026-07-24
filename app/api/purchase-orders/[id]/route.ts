import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hasPermissionOrRole } from '@/lib/auth/permissions';
import { withTenantRoute, jsonOk } from '@/lib/api/with-route';
import type { POStatus } from '@prisma/client';

type LineItem = { productId: string; quantity: number; unitPrice?: number; name?: string };

export const PATCH = withTenantRoute(async (request, { session, companyId }, routeContext) => {
  const allowed = await hasPermissionOrRole(
    session,
    'inventory:write',
    'SUPER_ADMIN',
    'ADMIN'
  );
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const id = (await routeContext!.params).id;
  const body = await request.json();
  const action = typeof body.action === 'string' ? body.action : '';
  const statusRaw = typeof body.status === 'string' ? body.status.toUpperCase() : '';

  const existing = await prisma.purchaseOrder.findFirst({
    where: { id, companyId },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (statusRaw === 'DRAFT' && !action) {
    if (existing.status === 'RECEIVED') {
      return NextResponse.json(
        { error: 'Received POs cannot move back to draft' },
        { status: 400 }
      );
    }
    const order = await prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'DRAFT' as POStatus },
      include: { supplier: { select: { id: true, name: true, email: true } } },
    });
    return jsonOk(order);
  }

  if (action === 'approve' || statusRaw === 'SENT') {
    if (existing.status !== 'DRAFT' && existing.status !== 'SENT') {
      return NextResponse.json({ error: 'Only draft POs can be approved/sent' }, { status: 400 });
    }
    const order = await prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'SENT' as POStatus, approvedAt: new Date() },
      include: { supplier: { select: { id: true, name: true, email: true } } },
    });
    return jsonOk(order);
  }

  if (action === 'cancel' || statusRaw === 'CANCELLED') {
    if (existing.status === 'RECEIVED') {
      return NextResponse.json(
        { error: 'Received POs cannot be cancelled' },
        { status: 400 }
      );
    }
    const order = await prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: { supplier: { select: { id: true, name: true, email: true } } },
    });
    return jsonOk(order);
  }

  if (action === 'receive' || statusRaw === 'RECEIVED') {
    if (existing.status === 'CANCELLED') {
      return NextResponse.json({ error: 'Cancelled PO cannot be received' }, { status: 400 });
    }
    const items = (Array.isArray(existing.lineItems) ? existing.lineItems : []) as LineItem[];
    if (!items.length) {
      return NextResponse.json(
        { error: 'Add line items before receiving stock' },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        await tx.product.updateMany({
          where: { id: item.productId, companyId },
          data: { quantity: { increment: item.quantity } },
        });
        await tx.inventoryRecord.create({
          data: {
            productId: item.productId,
            companyId,
            quantity: item.quantity,
            type: 'PURCHASE_IN',
            reason: `PO ${existing.poNumber} received`,
            price: item.unitPrice ?? 0,
          },
        });
      }
      await tx.purchaseOrder.update({
        where: { id },
        data: { status: 'RECEIVED', receivedAt: new Date() },
      });
    });

    const order = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: { supplier: { select: { id: true, name: true, email: true } } },
    });
    return jsonOk(order);
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
});
