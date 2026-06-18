import { handleRouteError } from '@/lib/api/tenant-response';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { asNextRequest } from '@/lib/api/as-next-request';
import {
  resolveCompanyContextFromRequest,
  TenantError,
} from '@/lib/auth/company-membership';

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { companyId } = await resolveCompanyContextFromRequest(
      session,
      asNextRequest(request)
    );

    const now = new Date();
    const expiringBefore = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [products, expiringBatches] = await Promise.all([
      prisma.product.findMany({
        where: { companyId },
        select: {
          id: true,
          name: true,
          sku: true,
          quantity: true,
          minQuantity: true,
          price: true,
        },
      }),
      prisma.batchItem.findMany({
        where: {
          expiryDate: { gte: now, lte: expiringBefore },
          product: { companyId },
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              quantity: true,
              minQuantity: true,
              price: true,
            },
          },
          location: { select: { id: true, name: true, code: true } },
        },
      }),
    ]);

    const lowStock = products
      .filter((p) => p.minQuantity > 0 && p.quantity <= p.minQuantity)
      .map((product) => ({
        type: 'LOW_STOCK' as const,
        product,
        threshold: product.minQuantity,
        currentQuantity: product.quantity,
      }));

    const expiringSoon = expiringBatches.map((batch) => ({
      type: 'EXPIRING' as const,
      product: batch.product,
      currentQuantity: batch.quantity,
      expiryDate: batch.expiryDate,
      location: batch.location,
    }));

    return NextResponse.json({
      data: { lowStock, expiringSoon },
    });
  } catch (error) {
    return handleRouteError(error);
    console.error('[api/inventory/alerts GET]', error);
    return NextResponse.json({ error: 'Failed to fetch alerts' }, { status: 500 });
  }
}
