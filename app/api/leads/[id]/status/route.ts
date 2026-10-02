import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/api-error-handler';
import { isApiException } from '@/lib/api/subscription-guards';
import { rejectIfOutsideCompanyPipeline } from '@/lib/pipelines/assert-stage';
import { LeadStatus } from '@prisma/client';
import { leadAccessWhere, requireLeadAccess } from '@/app/api/leads/lead-access';
import { resolveCompanyContextFromRequest } from '@/lib/auth/company-membership';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const leadCtx = await requireLeadAccess(request);
    const session = leadCtx.session;

    const resolvedParams = await params;
    const data = await request.json();

    if (
      typeof data?.status !== 'string' ||
      !(Object.values(LeadStatus) as string[]).includes(data.status)
    ) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const lead = await prisma.lead.findFirst({
      where: { id: resolvedParams.id, ...leadAccessWhere(leadCtx) },
    });

    if (!lead) {
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

    const { dispatchWorkflowEvent } = await import('@/lib/workflows/executor');
    void dispatchWorkflowEvent('lead.updated', {
      userId: session.user.id,
      leadId: resolvedParams.id,
      companyId: lead.companyId,
      title: 'Lead updated',
      summary: `Lead status → ${data.status}`,
      metadata: { oldStatus: lead.status, newStatus: data.status, status: data.status },
    });

    return NextResponse.json(updatedLead);
  } catch (error) {
    if (isApiException(error)) return handleApiError(error);
    console.error('Error updating lead status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
