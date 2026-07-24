import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { resolvePortalCustomerScope } from '@/lib/api/portal-billing-scope';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const scope = await resolvePortalCustomerScope(session);
    if (!scope.ok) {
      return NextResponse.json({ error: scope.error }, { status: scope.status });
    }

    const { id } = await params;
    const contract = await prisma.serviceContract.findFirst({
      where: {
        id,
        customerId: scope.customerId,
        status: { not: 'DRAFT' },
      },
      select: {
        id: true,
        type: true,
        status: true,
        contractNumber: true,
        title: true,
        startDate: true,
        endDate: true,
        reminderDays: true,
        annualValue: true,
        currency: true,
        includesParts: true,
        visitLimit: true,
        notes: true,
        equipment: {
          select: {
            id: true,
            serialNumber: true,
            product: { select: { name: true } },
          },
        },
      },
    });

    if (!contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
    }

    return NextResponse.json(contract);
  } catch (error) {
    console.error('[api/portal/contracts/[id] GET]', error);
    return NextResponse.json({ error: 'Failed to load contract' }, { status: 500 });
  }
}
