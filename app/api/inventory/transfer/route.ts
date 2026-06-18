import { auth } from '@/auth'
import { handleRouteError } from '@/lib/api/tenant-response';
import { prisma } from '@/lib/prisma'
import type { PrismaClient } from '@prisma/client'
import { asNextRequest } from '@/lib/api/as-next-request'
import {
  resolveCompanyContextFromRequest,
  TenantError,
} from '@/lib/auth/company-membership'

type InventoryTransferTx = Pick<
  PrismaClient,
  'inventoryRecord' | 'stockTransfer'
>

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const { companyId } = await resolveCompanyContextFromRequest(session, asNextRequest(request))

    const { productId, sourceLocationId, targetLocationId, quantity, batchNumber } =
      await request.json()

    if (!productId || !sourceLocationId || !targetLocationId || !quantity) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const productOk = await prisma.product.findFirst({
      where: { id: productId, companyId },
      select: { id: true },
    })
    const [srcLoc, tgtLoc] = await Promise.all([
      prisma.location.findFirst({ where: { id: sourceLocationId, companyId } }),
      prisma.location.findFirst({ where: { id: targetLocationId, companyId } }),
    ])
    if (!productOk || !srcLoc || !tgtLoc) {
      return new Response(JSON.stringify({ error: 'Invalid product or locations' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const result = await prisma.$transaction(async (tx: InventoryTransferTx) => {
      const sourceInventory = await tx.inventoryRecord.findFirst({
        where: {
          productId,
          locationId: sourceLocationId,
          type: 'IN_STOCK',
          companyId,
        },
        orderBy: { createdAt: 'desc' },
      })

      if (!sourceInventory || sourceInventory.quantity < quantity) {
        throw new Error('Insufficient stock at source location')
      }

      const stockTransfer = await tx.stockTransfer.create({
        data: {
          productId,
          sourceLocationId,
          targetLocationId,
          quantity,
          batchNumber: batchNumber ?? null,
          companyId,
        },
        include: {
          product: true,
          sourceLocation: true,
          targetLocation: true,
        },
      })

      await tx.inventoryRecord.create({
        data: {
          productId,
          locationId: sourceLocationId,
          companyId,
          quantity: -quantity,
          type: 'TRANSFER_OUT',
          reason: 'Stock Transfer',
          price: sourceInventory.price,
        },
      })

      await tx.inventoryRecord.create({
        data: {
          productId,
          locationId: targetLocationId,
          companyId,
          quantity,
          type: 'TRANSFER_IN',
          reason: 'Stock Transfer',
          price: sourceInventory.price,
        },
      })

      return stockTransfer
    })

    return new Response(JSON.stringify({ success: true, data: result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    if (error instanceof TenantError) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: error.status,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to process transfer',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}
