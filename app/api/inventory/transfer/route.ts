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
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return new Response(JSON.stringify({ error: 'Quantity must be a positive whole number' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    if (sourceLocationId === targetLocationId) {
      return new Response(
        JSON.stringify({ error: 'Source and target locations must be different' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
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
      // Location balance = all movements at the source location (TRANSFER_OUT rows are
      // stored negative; outbound stock rows are stored positive and must be subtracted).
      const movements = await tx.inventoryRecord.findMany({
        where: { productId, locationId: sourceLocationId, companyId },
        select: { quantity: true, type: true, price: true },
        orderBy: { createdAt: 'desc' },
      })
      const OUTBOUND = new Set(['OUT', 'SERVICE_OUT', 'STOCK_OUT', 'ADJUSTMENT_OUT'])
      const available = movements.reduce(
        (sum, m) =>
          sum + (OUTBOUND.has(String(m.type).toUpperCase()) ? -Math.abs(m.quantity) : m.quantity),
        0
      )

      if (available < quantity) {
        throw new Error(`Insufficient stock at source location. Available: ${Math.max(0, available)}`)
      }
      const sourceInventory = { price: movements[0]?.price ?? 0 }

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
    }, { isolationLevel: 'Serializable' })

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
    const insufficient =
      error instanceof Error && error.message.startsWith('Insufficient stock')
    return new Response(
      JSON.stringify({
        error: insufficient ? (error as Error).message : 'Failed to process transfer',
      }),
      {
        status: insufficient ? 400 : 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}
