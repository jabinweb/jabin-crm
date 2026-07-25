import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { enrichmentService } from '@/lib/enrichment/enrichment-service';
import { handleApiError } from '@/lib/api-error-handler';
import { guardAgentFeature, isApiException } from '@/lib/api/subscription-guards';
import { resolveCompanyContextFromRequest } from '@/lib/auth/company-membership';
import { handleRouteError } from '@/lib/api/tenant-response';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await guardAgentFeature(session.user as { id: string; role?: string }, 'LEADS');

    const { id } = await params;
    const role = (session.user as { role?: string }).role;
    const isAdmin =
      role === 'ADMIN' ||
      role === 'SUPER_ADMIN' ||
      role === 'SALES' ||
      role === 'SUPPORT_MANAGER';

    let companyId: string | undefined;
    try {
      const ctx = await resolveCompanyContextFromRequest(session, request);
      companyId = ctx.companyId;
    } catch {
      /* fall through */
    }

    const lead = await prisma.lead.findFirst({
      where: {
        id,
        ...(companyId && isAdmin
          ? { companyId }
          : { userId: session.user.id }),
      },
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
