import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { enrichmentService } from '@/lib/enrichment/enrichment-service';
import { handleApiError } from '@/lib/api-error-handler';
import { isApiException } from '@/lib/api/subscription-guards';
import { resolveCompanyContextFromRequest } from '@/lib/auth/company-membership';
import { leadAccessWhere, requireLeadAccess } from '@/app/api/leads/lead-access';
import { handleRouteError } from '@/lib/api/tenant-response';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const leadCtx = await requireLeadAccess(request);
    const session = leadCtx.session;

    const { id } = await params;
    const lead = await prisma.lead.findFirst({
      where: { id, ...leadAccessWhere(leadCtx) },
      select: { id: true },
    });

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    const enrichmentData = await enrichmentService.enrichLead(id);

    return NextResponse.json({ success: true, data: enrichmentData });
  } catch (error) {
    if (isApiException(error)) return handleApiError(error);
    console.error('Error enriching lead:', error);
    return handleRouteError(error);
  }
}
