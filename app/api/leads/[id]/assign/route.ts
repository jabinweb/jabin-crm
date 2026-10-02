import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/api-error-handler';
import { guardAgentFeature, isApiException } from '@/lib/api/subscription-guards';
import { userHasCompanyAccess } from '@/lib/auth/company-membership';

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

    const existing = await prisma.lead.findFirst({
      where: { id: params.id, userId: session.user.id },
      select: { companyId: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Assignee must belong to the lead's workspace.
    if (assignedToId) {
      if (
        typeof assignedToId !== 'string' ||
        !existing.companyId ||
        !(await userHasCompanyAccess(assignedToId, existing.companyId))
      ) {
        return NextResponse.json({ error: 'Invalid assignee' }, { status: 400 });
      }
    }

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
