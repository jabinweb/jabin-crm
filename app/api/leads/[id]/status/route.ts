import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/api-error-handler';
import { guardAgentFeature, isApiException } from '@/lib/api/subscription-guards';
import { rejectIfOutsideCompanyPipeline } from '@/lib/pipelines/assert-stage';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await guardAgentFeature(session.user as { id: string; role?: string }, 'LEADS');

    const resolvedParams = await params;
    const data = await request.json();

    const lead = await prisma.lead.findUnique({
      where: { id: resolvedParams.id },
    });

    const role = (session.user as { role?: string }).role;
    const canAccess =
      lead &&
      (lead.userId === session.user.id ||
        (lead.companyId &&
          ['ADMIN', 'SUPER_ADMIN', 'SALES', 'SUPPORT_MANAGER'].includes(String(role))));

    if (!canAccess) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    const rejected = await rejectIfOutsideCompanyPipeline(
      lead.companyId,
      'leads',
      data.status
    );
    if (rejected) return rejected;

    const updatedLead = await prisma.lead.update({
      where: { id: resolvedParams.id },
      data: { status: data.status },
    });

    await prisma.leadActivity.create({
      data: {
        leadId: resolvedParams.id,
        activityType: 'STATUS_CHANGED',
        description: `Status changed to ${data.status}`,
        userId: session.user.id,
        metadata: { oldStatus: lead.status, newStatus: data.status },
      },
    });

    return NextResponse.json(updatedLead);
  } catch (error) {
    if (isApiException(error)) return handleApiError(error);
    console.error('Error updating lead status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
