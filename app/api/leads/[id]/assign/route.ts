import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/api-error-handler';
import { guardAgentFeature, isApiException } from '@/lib/api/subscription-guards';

// Assign a lead to a team member
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await guardAgentFeature(session.user as { id: string; role?: string }, 'LEADS');

    const params = await context.params;
    const body = await request.json();
    const { assignedToId } = body;

    const lead = await prisma.lead.update({
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

    return NextResponse.json(lead);
  } catch (error) {
    if (isApiException(error)) return handleApiError(error);
    console.error('Lead assignment error:', error);
    return NextResponse.json(
      { error: 'Failed to assign lead' },
      { status: 500 }
    );
  }
}
