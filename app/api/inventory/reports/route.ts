import { auth } from '@/auth'
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { asNextRequest } from '@/lib/api/as-next-request'
import {
  resolveCompanyContextFromRequest,
  TenantError,
} from '@/lib/auth/company-membership'

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { companyId } = await resolveCompanyContextFromRequest(session, asNextRequest(request))

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'stock';
    const period = searchParams.get('period') || 'month';

    let startDate = new Date();
    switch (period) {
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(startDate.getMonth() - 3);
        break;
      case 'year':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
    }

    let reportData;
    switch (type) {
      case 'stock':
        reportData = await prisma.product.findMany({
          where: { companyId },
          select: {
            name: true,
            quantity: true,
            price: true,
          },
        });
        break;

      case 'movement':
        reportData = await prisma.inventoryRecord.groupBy({
          by: ['type'],
          where: {
            companyId,
            createdAt: {
              gte: startDate,
            },
          },
          _sum: {
            quantity: true,
          },
        });
        break;

      case 'value':
        reportData = await prisma.product.aggregate({
          where: { companyId },
          _sum: {
            quantity: true,
          },
          _avg: {
            price: true,
          },
        });
        break;
    }

    return NextResponse.json({ data: reportData });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}
