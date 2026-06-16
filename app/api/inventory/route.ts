import { auth } from '@/auth';
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { asNextRequest } from '@/lib/api/as-next-request';
import {
  resolveCompanyContextFromRequest,
  TenantError,
} from '@/lib/auth/company-membership';
import { Prisma } from "@prisma/client";
import "@/types/auth";
import type { PrismaClient } from "@prisma/client";

type InventoryTx = Pick<PrismaClient, "product" | "inventoryRecord">;

type InventoryItemRow = Prisma.InventoryRecordGetPayload<{
  include: {
    product: { select: { id: true; name: true; sku: true } };
    location: { select: { id: true; name: true; code: true } };
  };
}>;

type ProductRow = Prisma.ProductGetPayload<{
  select: {
    id: true;
    name: true;
    sku: true;
    quantity: true;
    price: true;
    minQuantity: true;
    maxQuantity: true;
    _count: { select: { inventoryRecords: true } };
  };
}>;

// Safe logging utility
function safeLog(message: string, data?: any) {
  try {
    console.log(message, data ? JSON.stringify(data, null, 2) : '');
  } catch (e) {
    console.log(message, 'Data could not be stringified');
  }
}

// Improved error handling utility
function handleError(error: unknown, context: string) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  const errorDetails = {
    context,
    message: errorMessage,
    timestamp: new Date().toISOString(),
  };

  safeLog(`Inventory Error [${context}]:`, errorDetails);

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // Handle Prisma specific errors
    const prismaError = {
      code: error.code,
      message: errorMessage,
      details: errorDetails,
    };

    switch (error.code) {
      case 'P2025':
        return NextResponse.json({ error: prismaError }, { status: 404 });
      case 'P2002':
        return NextResponse.json({ error: prismaError }, { status: 409 });
      default:
        return NextResponse.json({ error: prismaError }, { status: 500 });
    }
  }

  return NextResponse.json(
    { error: errorDetails },
    { status: 500 }
  );
}

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    const { companyId } = await resolveCompanyContextFromRequest(session, asNextRequest(req))

    const { productId, quantity, reason, notes, type = 'IN_STOCK' } = await req.json()

    const inventory = await prisma.$transaction(async (tx: InventoryTx) => {
      const product = await tx.product.findUnique({
        where: { id: productId }
      })

      if (!product || product.companyId !== companyId) {
        throw new Error('Product not found')
      }

      // Create inventory record
      const record = await tx.inventoryRecord.create({
        data: {
          type,
          quantity,
          price: product.price ?? 0,
          productId,
          companyId,
          reason,
          ...(notes && { notes }),
        }
      })

      // Update product quantity
      const updatedProduct = await tx.product.update({
        where: { id: productId },
        data: {
          quantity: {
            increment: quantity
          }
        }
      })

      return {
        inventory: record,
        product: updatedProduct
      }
    })

    return new Response(JSON.stringify(inventory), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return handleError(error, "Failed to create inventory record")
  }
}

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    const { companyId } = await resolveCompanyContextFromRequest(session, asNextRequest(request))

    const url = new URL(request.url);
    const productId = url.searchParams.get('productId');

    const [inventoryItems, products] = (await Promise.all([
      prisma.inventoryRecord.findMany({
        where: {
          companyId,
          ...(productId ? { productId } : {})
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
            }
          },
          location: {
            select: {
              id: true,
              name: true,
              code: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' },
      }),
      !productId ? prisma.product.findMany({
        where: { 
          companyId,
        },
        select: {
          id: true,
          name: true,
          sku: true,
          quantity: true,
          price: true,
          minQuantity: true,
          maxQuantity: true,
          _count: {
            select: {
              inventoryRecords: true
            }
          }
        },
      }) : null
    ])) as [InventoryItemRow[], ProductRow[] | null];

    // Process products to include stock status
    const processedProducts = products?.map((product: ProductRow) => ({
      ...product,
      stockStatus: {
        isLowStock: typeof product.minQuantity === 'number' && product.quantity <= product.minQuantity,
        isOverStock: typeof product.maxQuantity === 'number' && product.quantity > product.maxQuantity,
      },
      _count: {
        inventory: product._count.inventoryRecords
      }
    }));

    return NextResponse.json({
      data: {
        inventory: inventoryItems.map((item: InventoryItemRow) => ({
          ...item,
          product: item.product,
          location: item.location
        })),
        products: processedProducts || []
      }
    });

  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return handleError(error, "Failed to fetch inventory data");
  }
}

