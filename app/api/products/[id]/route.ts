import { auth } from '@/auth'
import { handleRouteError } from '@/lib/api/tenant-response';
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import "@/types/auth";
import {
  resolveCompanyContextFromRequest,
  TenantError,
} from '@/lib/auth/company-membership'


export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return new NextResponse(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const { companyId } = await resolveCompanyContextFromRequest(session, request)
    const resolvedParams = await params;
    const productId = resolvedParams.id;

    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        companyId,
      },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        category: true,
        quantity: true,
        sku: true,
        imageUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!product) {
      return new NextResponse(
        JSON.stringify({ error: "Product not found" }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    return new NextResponse(
      JSON.stringify(product),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    if (error instanceof TenantError) {
      return new NextResponse(JSON.stringify({ error: error.message }), {
        status: error.status,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    return new NextResponse(
      JSON.stringify({ error: "Failed to fetch product" }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return new NextResponse(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const { companyId } = await resolveCompanyContextFromRequest(session, request)
    const resolvedParams = await params;
    const productId = resolvedParams.id;

    const existing = await prisma.product.findFirst({
      where: { id: productId, companyId },
      select: { id: true },
    })
    if (!existing) {
      return new NextResponse(
        JSON.stringify({ error: "Product not found" }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
    }

    await prisma.product.delete({
      where: { id: productId },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof TenantError) {
      return new NextResponse(JSON.stringify({ error: error.message }), {
        status: error.status,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    return new NextResponse(
      JSON.stringify({ error: "Failed to delete product" }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return new NextResponse(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const { companyId } = await resolveCompanyContextFromRequest(session, request)
    const resolvedParams = await params;
    const productId = resolvedParams.id;
    const data = await request.json();

    const existing = await prisma.product.findFirst({
      where: { id: productId, companyId },
      select: { id: true },
    })
    if (!existing) {
      return new NextResponse(
        JSON.stringify({ error: "Product not found" }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const product = await prisma.product.update({
      where: { id: productId },
      data: {
        name: data.name,
        description: data.description,
        price: data.price,
        category: data.category,
        quantity: data.quantity,
        sku: data.sku,
        imageUrl: data.imageUrl,
      },
    });

    return new NextResponse(
      JSON.stringify(product),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    if (error instanceof TenantError) {
      return new NextResponse(JSON.stringify({ error: error.message }), {
        status: error.status,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    return new NextResponse(
      JSON.stringify({ error: "Failed to update product" }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
