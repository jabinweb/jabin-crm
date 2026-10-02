import { auth } from '@/auth'
import { checkOpsAccess } from '@/lib/crm/ops-access'
import { handleRouteError } from '@/lib/api/tenant-response';
import { prisma } from '@/lib/prisma'
import { asNextRequest } from '@/lib/api/as-next-request'
import {
  resolveCompanyContextFromRequest,
  TenantError,
} from '@/lib/auth/company-membership'

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const { companyId } = await resolveCompanyContextFromRequest(session, asNextRequest(req))
    // Same audience as the nav: plan module on, and stock changes need inventory write access
    const denied = await checkOpsAccess(session, companyId, { permission: 'inventory:write', module: 'INVENTORY' })
    if (denied) return denied

    const { batchNumber, serialNumber, quantity, expiryDate, productId, locationId } =
      await req.json()

    if (
      typeof batchNumber !== 'string' ||
      !batchNumber.trim() ||
      !Number.isInteger(quantity) ||
      quantity <= 0 ||
      typeof productId !== 'string' ||
      typeof locationId !== 'string' ||
      (expiryDate && Number.isNaN(new Date(expiryDate).getTime()))
    ) {
      return new Response(
        JSON.stringify({
          error: 'batchNumber, productId, locationId and a positive whole quantity are required',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const [product, location] = await Promise.all([
      prisma.product.findFirst({ where: { id: productId, companyId } }),
      prisma.location.findFirst({ where: { id: locationId, companyId } }),
    ])
    if (!product || !location) {
      return new Response(JSON.stringify({ error: 'Invalid product or location' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const batch = await prisma.batchItem.create({
      data: {
        batchNumber,
        serialNumber,
        quantity,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        location: {
          connect: { id: locationId },
        },
        product: {
          connect: { id: productId },
        },
      },
    })

    return new Response(JSON.stringify(batch), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    if (error instanceof TenantError) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: error.status,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    console.error('Batch creation error:', error)
    return new Response(
      JSON.stringify({
        error: 'Failed to create batch',
        details: error instanceof Error ? error.message : undefined,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const { companyId } = await resolveCompanyContextFromRequest(session, asNextRequest(request))
    // Same audience as the nav: plan module on, and stock changes need inventory write access
    const denied = await checkOpsAccess(session, companyId, { module: 'INVENTORY' })
    if (denied) return denied

    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')
    const locationId = searchParams.get('locationId')

    const batches = await prisma.batchItem.findMany({
      where: {
        product: { companyId },
        ...(productId && { productId }),
        ...(locationId && { locationId }),
      },
      include: {
        product: true,
        location: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return new Response(JSON.stringify({ data: batches }), {
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
        error: 'Failed to fetch batches',
        details: error instanceof Error ? error.message : undefined,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}
