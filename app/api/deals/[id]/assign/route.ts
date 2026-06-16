import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-error-handler';
import { isApiException } from '@/lib/api/subscription-guards';
import { withModuleAccess } from '@/lib/api/module-guard';
import { prisma } from '@/lib/prisma';

// Assign a deal to a team member
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await withModuleAccess('DEALS');

    const params = await context.params;
    const body = await request.json();
    const { assignedToId } = body;

    const deal = await prisma.deal.update({
      where: {
        id: params.id,
        userId: session.user.id,
      },
      data: {
        assignedToId: assignedToId || null,
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    return NextResponse.json(deal);
  } catch (error) {
    if (isApiException(error)) return handleApiError(error);
    console.error('Deal assignment error:', error);
    return NextResponse.json(
      { error: 'Failed to assign deal' },
      { status: 500 }
    );
  }
}
